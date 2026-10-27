// Group timetables end to end: PUT /teacher/groups/:groupId/schedule, every
// response that shows a timetable (grade page, grade cards, rename, profile,
// Home), and the two time-based queries with a fixed clock.
// Real database (diraya_test_db), real app.

import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

import app from '../../app';
import { pool } from '../../config/db';
import { getFrontendOrigin } from '../../config/frontendOrigin';
import { assertTestDatabase } from '../../test/assertTestDatabase';
import { todayInCairo } from '../../utils/cairoDate';
import { findScheduledClassesOn } from '../attendance/attendance.repository';
import { AUTH_COOKIE_NAME } from '../auth/auth.cookie';
import { startTeacherSession } from '../auth/session/auth.session.service';

import { findNextSessions, replaceGroupSchedule } from './groups.repository';

let server: Server;
let baseUrl = '';
const teacherIds: string[] = [];

type Call = (method: string, path: string, body?: unknown) => Promise<[number, any]>;

async function one<T>(sql: string, params: unknown[]): Promise<T> {
  return (await pool.query(sql, params)).rows[0] as T;
}

// A teacher with one grade, two groups ("A", "B") and one student in A.
async function newTeacher(name: string) {
  const { id } = await one<{ id: string }>(
    `INSERT INTO teachers (full_name, email) VALUES ($1, $2) RETURNING id::text AS id`,
    [name, `schedule-api-${name}-${Date.now()}@example.com`]
  );
  teacherIds.push(id);

  const grade = (
    await one<{ id: string }>(
      `INSERT INTO grades (teacher_id, name, monthly_fee) VALUES ($1, 'Grade 1', 0) RETURNING id::text AS id`,
      [id]
    )
  ).id;
  const addGroup = async (groupName: string) =>
    (
      await one<{ id: string }>(
        `INSERT INTO groups (teacher_id, grade_id, name) VALUES ($1, $2, $3) RETURNING id::text AS id`,
        [id, grade, groupName]
      )
    ).id;
  const groupA = await addGroup('A');
  const groupB = await addGroup('B');
  const student = (
    await one<{ id: string }>(
      `
        INSERT INTO students (teacher_id, grade_id, group_id, full_name, code)
        VALUES ($1, $2, $3, 'Student', 'S-1') RETURNING id::text AS id
      `,
      [id, grade, groupA]
    )
  ).id;

  const { token } = await startTeacherSession(id, false);
  const call: Call = async (method, path, body) => {
    const response = await fetch(`${baseUrl}/api/v1/teacher${path}`, {
      method,
      headers: {
        origin: getFrontendOrigin(),
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? null : JSON.stringify(body),
    });
    const text = await response.text();
    return [response.status, text ? JSON.parse(text) : null];
  };

  return { id, grade, groupA, groupB, student, call };
}

const SAT_TUE = [
  { dayOfWeek: 2, startTime: '16:00' },
  { dayOfWeek: 6, startTime: '16:00' },
];
// Saturday first: Egypt's week.
const SAT_TUE_SORTED = [SAT_TUE[1], SAT_TUE[0]];

before(async () => {
  await assertTestDatabase();

  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.close();
  await pool.query('DELETE FROM teachers WHERE id = ANY ($1::bigint[])', [teacherIds]);
  await pool.end();
});

/* ---------------------------- PUT …/schedule ---------------------------- */

describe('PUT /teacher/groups/:groupId/schedule', () => {
  it('no session: 401', async () => {
    const t = await newTeacher('NoSession');
    const response = await fetch(`${baseUrl}/api/v1/teacher/groups/${t.groupA}/schedule`, {
      method: 'PUT',
      headers: { origin: getFrontendOrigin(), 'content-type': 'application/json' },
      body: JSON.stringify({ sessions: SAT_TUE }),
    });
    assert.equal(response.status, 401);
  });

  it('refuses bad input with 400, and saves nothing', async () => {
    const t = await newTeacher('Validator');

    for (const body of [
      { sessions: [{ dayOfWeek: 7, startTime: '16:00' }] },
      { sessions: [{ dayOfWeek: 6, startTime: '4pm' }] },
      { sessions: [{ dayOfWeek: 6, startTime: '24:00' }] },
      {
        sessions: [
          { dayOfWeek: 6, startTime: '16:00' },
          { dayOfWeek: 6, startTime: '18:00' },
        ],
      },
      { sessions: Array.from({ length: 8 }, (_, i) => ({ dayOfWeek: i % 7, startTime: '16:00' })) },
      { sessions: [{ dayOfWeek: 6, startTime: '16:00', room: 'B' }] },
      { sessions: SAT_TUE, extra: true },
      {},
    ]) {
      const [status, response] = await t.call('PUT', `/groups/${t.groupA}/schedule`, body);
      assert.equal(status, 400, JSON.stringify(body));
      assert.equal(response.code, 'INVALID_INPUT');
    }

    const [, details] = await t.call('GET', `/grades/${t.grade}`);
    assert.deepEqual(details.groups[0].sessions, []);
  });

  it('another teacher’s group, or a malformed id: 404 GROUP_NOT_FOUND', async () => {
    const owner = await newTeacher('Owner');
    const intruder = await newTeacher('Intruder');

    for (const groupId of [owner.groupA, 'abc']) {
      const [status, body] = await intruder.call('PUT', `/groups/${groupId}/schedule`, {
        sessions: SAT_TUE,
      });
      assert.equal(status, 404);
      assert.equal(body.code, 'GROUP_NOT_FOUND');
    }
  });

  it('saves the week and answers with the group AND its grade’s next class', async () => {
    const t = await newTeacher('Saver');

    const [status, body] = await t.call('PUT', `/groups/${t.groupA}/schedule`, {
      sessions: SAT_TUE,
    });

    assert.equal(status, 200);
    assert.deepEqual(body.group, { id: t.groupA, name: 'A', sessions: SAT_TUE_SORTED });
    assert.equal(body.grade.id, t.grade);
    assert.equal(body.grade.nextSession.groupName, 'A');
    const startsIn = Date.parse(body.grade.nextSession.startsAt) - Date.now();
    assert.ok(startsIn > 0 && startsIn <= 7 * 24 * 60 * 60 * 1000, 'within the coming week');
  });

  it('the same request twice gives the same result; an empty week clears it', async () => {
    const t = await newTeacher('Idempotent');

    const first = await t.call('PUT', `/groups/${t.groupA}/schedule`, { sessions: SAT_TUE });
    const second = await t.call('PUT', `/groups/${t.groupA}/schedule`, { sessions: SAT_TUE });
    assert.deepEqual(second, first);

    const [, cleared] = await t.call('PUT', `/groups/${t.groupA}/schedule`, { sessions: [] });
    assert.deepEqual(cleared.group.sessions, []);
    assert.equal(cleared.grade.nextSession, null);
  });
});

/* ------------------- Every response that shows a timetable ---------------- */

describe('the timetable shows wherever a group is sent', () => {
  it('grade page: each group with its own days, and the grade’s next class', async () => {
    const t = await newTeacher('GradePage');
    await t.call('PUT', `/groups/${t.groupA}/schedule`, { sessions: SAT_TUE });
    await t.call('PUT', `/groups/${t.groupB}/schedule`, {
      sessions: [{ dayOfWeek: 0, startTime: '18:00' }],
    });

    const [status, body] = await t.call('GET', `/grades/${t.grade}`);

    assert.equal(status, 200);
    assert.deepEqual(
      body.groups.map((group: any) => [group.name, group.sessions]),
      [
        ['A', SAT_TUE_SORTED],
        ['B', [{ dayOfWeek: 0, startTime: '18:00' }]],
      ]
    );
    assert.notEqual(body.grade.nextSession, null);
  });

  it('grade cards (the Students page): nextSession is filled', async () => {
    const t = await newTeacher('Cards');
    await t.call('PUT', `/groups/${t.groupA}/schedule`, { sessions: SAT_TUE });

    const [, body] = await t.call('GET', '/grades');

    assert.equal(body.grades[0].nextSession.groupName, 'A');
  });

  it('renaming a group answers with its timetable (it used to answer with none)', async () => {
    const t = await newTeacher('Renamer');
    await t.call('PUT', `/groups/${t.groupA}/schedule`, { sessions: SAT_TUE });

    const [status, body] = await t.call('PATCH', `/groups/${t.groupA}`, { name: 'Saturday group' });

    assert.equal(status, 200);
    assert.deepEqual(body.group, {
      id: t.groupA,
      name: 'Saturday group',
      sessions: SAT_TUE_SORTED,
    });
  });

  it('a new group starts with no timetable', async () => {
    const t = await newTeacher('Creator');

    const [status, body] = await t.call('POST', `/grades/${t.grade}/groups`, { name: 'C' });

    assert.equal(status, 201);
    assert.deepEqual(body.group.sessions, []);
  });

  it('student profile: their group’s days', async () => {
    const t = await newTeacher('Profile');
    await t.call('PUT', `/groups/${t.groupA}/schedule`, { sessions: SAT_TUE });

    const [status, body] = await t.call('GET', `/students/${t.student}`);

    assert.equal(status, 200);
    assert.deepEqual(body.profile.group.sessions, SAT_TUE_SORTED);
  });

  it('Home: today’s classes, with Egypt’s date', async () => {
    const t = await newTeacher('Home');
    const today = todayInCairo();
    const todayWeekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    await t.call('PUT', `/groups/${t.groupA}/schedule`, {
      sessions: [{ dayOfWeek: todayWeekday, startTime: '16:00' }],
    });

    const [, body] = await t.call('GET', '/home');

    assert.deepEqual(body.summary.classesToday, {
      date: today,
      classes: [
        {
          groupId: t.groupA,
          groupName: 'A',
          gradeId: t.grade,
          gradeName: 'Grade 1',
          startTime: '16:00',
          taken: false,
        },
      ],
    });
  });
});

/* ----------------------- Time-based queries, fixed clock ------------------ */

// October 2026: Egypt is UTC+3 (summer time ends on 29 Oct).
const cairo = (local: string) => new Date(`${local}+03:00`);

describe('findNextSessions (fixed clock)', () => {
  it('picks the soonest upcoming slot across the grade’s groups', async () => {
    const t = await newTeacher('NextClock');
    await replaceGroupSchedule(t.id, t.groupA, [
      { weekday: 6, startTime: '16:00' },
      { weekday: 2, startTime: '16:00' },
    ]);
    await replaceGroupSchedule(t.id, t.groupB, [{ weekday: 0, startTime: '18:00' }]);

    const nextAt = async (now: string) => {
      const [next] = await findNextSessions(t.id, [t.grade], cairo(now));
      return next && { group: next.groupName, at: next.startsAt.toISOString() };
    };

    // Saturday 10 Oct, 15:00: today's 16:00 class is next.
    assert.deepEqual(await nextAt('2026-10-10T15:00:00'), {
      group: 'A',
      at: cairo('2026-10-10T16:00:00').toISOString(),
    });
    // 16:00 exactly: it has started, so it isn't "next". Sunday's is.
    assert.deepEqual(await nextAt('2026-10-10T16:00:00'), {
      group: 'B',
      at: cairo('2026-10-11T18:00:00').toISOString(),
    });
    // Tuesday 13 Oct, 17:00: everything this week is past; it wraps to Saturday.
    assert.deepEqual(await nextAt('2026-10-13T17:00:00'), {
      group: 'A',
      at: cairo('2026-10-17T16:00:00').toISOString(),
    });
  });

  it('uses Egypt’s clock: at 01:30 Saturday in Cairo (still Friday in UTC), Saturday’s 01:00 class is over', async () => {
    const t = await newTeacher('NextMidnight');
    await replaceGroupSchedule(t.id, t.groupA, [{ weekday: 6, startTime: '01:00' }]);

    const [next] = await findNextSessions(t.id, [t.grade], cairo('2026-10-10T01:30:00'));

    // Next week's, not tonight's: in UTC it would still look upcoming.
    assert.equal(next!.startsAt.toISOString(), cairo('2026-10-17T01:00:00').toISOString());
  });

  it('a grade without any timetable has no next class', async () => {
    const t = await newTeacher('NextNone');

    assert.deepEqual(await findNextSessions(t.id, [t.grade], new Date()), []);
  });
});

describe('findScheduledClassesOn (fixed day)', () => {
  it('lists that weekday’s classes only, this teacher’s only, and marks the taken ones', async () => {
    const t = await newTeacher('Today');
    const other = await newTeacher('OtherToday');
    await replaceGroupSchedule(t.id, t.groupA, [{ weekday: 6, startTime: '16:00' }]);
    await replaceGroupSchedule(t.id, t.groupB, [{ weekday: 0, startTime: '18:00' }]);
    await replaceGroupSchedule(other.id, other.groupA, [{ weekday: 6, startTime: '10:00' }]);

    // Saturday 10 Oct 2026.
    const before = await findScheduledClassesOn(t.id, '2026-10-10');
    assert.deepEqual(
      before.map((item) => [item.groupName, item.startTime, item.taken]),
      [['A', '16:00', false]]
    );

    // Attendance taken for A that day -> "taken".
    await pool.query(
      `INSERT INTO class_sessions (teacher_id, grade_id, group_id, held_on) VALUES ($1, $2, $3, '2026-10-10')`,
      [t.id, t.grade, t.groupA]
    );
    const after = await findScheduledClassesOn(t.id, '2026-10-10');
    assert.equal(after[0]!.taken, true);
  });
});
