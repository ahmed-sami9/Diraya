// Group timetables at the database level: replace-all, ownership, the
// database's own rules, and two saves at once. Real database (diraya_test_db).

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { pool } from '../../config/db';
import { assertTestDatabase } from '../../test/assertTestDatabase';

import {
  findSchedulesByGroups,
  replaceGroupSchedule,
  type ScheduleSlot,
} from './groups.repository';

const teacherIds: string[] = [];

async function one<T>(sql: string, params: unknown[]): Promise<T> {
  return (await pool.query(sql, params)).rows[0] as T;
}

// A teacher with one grade and `groupCount` groups.
async function newTeacher(name: string, groupCount = 1) {
  const { id } = await one<{ id: string }>(
    `INSERT INTO teachers (full_name, email) VALUES ($1, $2) RETURNING id::text AS id`,
    [name, `groups-repo-${name}-${Date.now()}@example.com`]
  );
  teacherIds.push(id);

  const grade = await one<{ id: string }>(
    `INSERT INTO grades (teacher_id, name, monthly_fee) VALUES ($1, 'Grade 1', 0) RETURNING id::text AS id`,
    [id]
  );

  const groups: string[] = [];
  for (let i = 0; i < groupCount; i++) {
    const group = await one<{ id: string }>(
      `INSERT INTO groups (teacher_id, grade_id, name) VALUES ($1, $2, $3) RETURNING id::text AS id`,
      [id, grade.id, `Group ${i + 1}`]
    );
    groups.push(group.id);
  }

  return { id, groups };
}

const SAT_TUE: ScheduleSlot[] = [
  { weekday: 2, startTime: '16:00' }, // Tuesday, listed first on purpose
  { weekday: 6, startTime: '16:00' }, // Saturday
];

const scheduleOf = async (teacherId: string, groupId: string) =>
  (await findSchedulesByGroups(teacherId, [groupId])).map(({ weekday, startTime }) => ({
    weekday,
    startTime,
  }));

before(assertTestDatabase);

after(async () => {
  await pool.query('DELETE FROM teachers WHERE id = ANY ($1::bigint[])', [teacherIds]);
  await pool.end();
});

describe('replaceGroupSchedule', () => {
  it('saves the timetable and returns it Saturday-first (Egypt’s week)', async () => {
    const t = await newTeacher('Saver');

    const result = await replaceGroupSchedule(t.id, t.groups[0]!, SAT_TUE);

    const expected = [
      { weekday: 6, startTime: '16:00' },
      { weekday: 2, startTime: '16:00' },
    ];
    assert.deepEqual(result, { status: 'saved', slots: expected });
    assert.deepEqual(await scheduleOf(t.id, t.groups[0]!), expected);
  });

  it('replaces the whole week, and an empty list clears it', async () => {
    const t = await newTeacher('Replacer');
    const group = t.groups[0]!;

    await replaceGroupSchedule(t.id, group, SAT_TUE);
    await replaceGroupSchedule(t.id, group, [{ weekday: 1, startTime: '18:30' }]);
    assert.deepEqual(await scheduleOf(t.id, group), [{ weekday: 1, startTime: '18:30' }]);

    await replaceGroupSchedule(t.id, group, []);
    assert.deepEqual(await scheduleOf(t.id, group), []);
  });

  it('another teacher’s group: not-found, and their timetable is untouched', async () => {
    const owner = await newTeacher('Owner');
    const intruder = await newTeacher('Intruder');
    await replaceGroupSchedule(owner.id, owner.groups[0]!, SAT_TUE);

    const result = await replaceGroupSchedule(intruder.id, owner.groups[0]!, []);

    assert.deepEqual(result, { status: 'not-found' });
    assert.equal((await scheduleOf(owner.id, owner.groups[0]!)).length, 2);
    // Reading with the wrong teacher finds nothing either.
    assert.deepEqual(await scheduleOf(intruder.id, owner.groups[0]!), []);
  });

  it('a save the database refuses changes nothing (all or nothing)', async () => {
    const t = await newTeacher('Atomic');
    const group = t.groups[0]!;
    await replaceGroupSchedule(t.id, group, SAT_TUE);

    const refused: ScheduleSlot[][] = [
      [
        { weekday: 0, startTime: '16:00' },
        { weekday: 0, startTime: '18:00' }, // the same day twice
      ],
      [{ weekday: 7, startTime: '16:00' }], // no such weekday
      [{ weekday: 3, startTime: '16:00:30' }], // not a whole minute
    ];

    for (const slots of refused) {
      await assert.rejects(replaceGroupSchedule(t.id, group, slots), JSON.stringify(slots));
      assert.equal((await scheduleOf(t.id, group)).length, 2, JSON.stringify(slots));
    }
  });

  it('saves at the same moment: one wins whole, never a mix or an error', async () => {
    const t = await newTeacher('Racer');
    const group = t.groups[0]!;
    // Eight saves at once, all including Saturday: without the row lock they
    // delete each other's rows halfway and collide on the duplicate Saturday.
    const versions: ScheduleSlot[][] = Array.from({ length: 8 }, (_, i) => [
      { weekday: 6, startTime: `1${i}:00` },
      { weekday: i % 6, startTime: '18:00' },
    ]);

    const results = await Promise.all(
      versions.map((slots) => replaceGroupSchedule(t.id, group, slots))
    );

    assert.ok(results.every((result) => result.status === 'saved'));
    const final = JSON.stringify(await scheduleOf(t.id, group));
    const whole = versions.map((slots) =>
      JSON.stringify([...slots].sort((a, b) => ((a.weekday + 1) % 7) - ((b.weekday + 1) % 7)))
    );
    assert.ok(whole.includes(final), `not one whole version: ${final}`);
  });
});

describe('findSchedulesByGroups', () => {
  it('reads several groups in one call, each tagged with its group', async () => {
    const t = await newTeacher('Reader', 2);
    await replaceGroupSchedule(t.id, t.groups[0]!, SAT_TUE);
    await replaceGroupSchedule(t.id, t.groups[1]!, [{ weekday: 0, startTime: '18:00' }]);

    const rows = await findSchedulesByGroups(t.id, t.groups);

    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.filter((row) => row.groupId === t.groups[1]).map((row) => row.weekday),
      [0]
    );
  });
});

describe('when a group or teacher is deleted', () => {
  it('their timetable goes with them', async () => {
    const t = await newTeacher('Leaver', 2);
    await replaceGroupSchedule(t.id, t.groups[0]!, SAT_TUE);
    await replaceGroupSchedule(t.id, t.groups[1]!, SAT_TUE);

    await pool.query('DELETE FROM groups WHERE id = $1', [t.groups[0]]);
    assert.deepEqual(await scheduleOf(t.id, t.groups[0]!), []);

    await pool.query('DELETE FROM teachers WHERE id = $1', [t.id]);
    const left = await one<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM group_schedules WHERE teacher_id = $1',
      [t.id]
    );
    assert.equal(left.n, 0);
  });
});
