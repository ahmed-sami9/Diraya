// Recent activity end to end: each of the six actions, done through its real
// endpoint, logs exactly one entry with the right facts; a refused action
// logs nothing; GET /teacher/activity reads it back.
// Real database (diraya_test_db), real app.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

import app from '../../app';
import { pool } from '../../config/db';
import { getFrontendOrigin } from '../../config/frontendOrigin';
import { assertTestDatabase } from '../../test/assertTestDatabase';
import { currentMonthInCairo, todayInCairo } from '../../utils/cairoDate';
import { AUTH_COOKIE_NAME } from '../auth/auth.cookie';
import { startTeacherSession } from '../auth/session/auth.session.service';

import { logActivity } from './activity.repository';

let server: Server;
let baseUrl = '';
const teacherIds: string[] = [];

type Call = (method: string, path: string, body?: unknown) => Promise<[number, any]>;

async function request(token: string | null, method: string, path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}/api/v1/teacher${path}`, {
    method,
    headers: {
      origin: getFrontendOrigin(),
      ...(token ? { cookie: `${AUTH_COOKIE_NAME}=${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? null : JSON.stringify(body),
  });
  const text = await response.text();
  return [response.status, text ? JSON.parse(text) : null] as [number, any];
}

async function one<T>(sql: string, params: unknown[]): Promise<T> {
  return (await pool.query(sql, params)).rows[0] as T;
}

// A teacher with "Grade 1" (fee 350), group "Sat & Tue · 4 PM" and one student.
async function newTeacher(name: string) {
  const { id } = await one<{ id: string }>(
    `INSERT INTO teachers (full_name, email) VALUES ($1, $2) RETURNING id::text AS id`,
    [name, `activity-api-${name}-${Date.now()}@example.com`]
  );
  teacherIds.push(id);

  const grade = (
    await one<{ id: string }>(
      `INSERT INTO grades (teacher_id, name, monthly_fee) VALUES ($1, 'Grade 1', 350) RETURNING id::text AS id`,
      [id]
    )
  ).id;
  const group = (
    await one<{ id: string }>(
      `INSERT INTO groups (teacher_id, grade_id, name) VALUES ($1, $2, 'Sat & Tue · 4 PM') RETURNING id::text AS id`,
      [id, grade]
    )
  ).id;
  const student = (
    await one<{ id: string }>(
      `
        INSERT INTO students (teacher_id, grade_id, group_id, full_name, code)
        VALUES ($1, $2, $3, 'Adam Mostafa', 'A-1') RETURNING id::text AS id
      `,
      [id, grade, group]
    )
  ).id;

  const { token } = await startTeacherSession(id, false);
  const call: Call = (method, path, body) => request(token, method, path, body);

  // The feed, oldest first, so each test can read "what was added last".
  const activity = async () => {
    const [status, body] = await call('GET', '/activity?limit=50');
    assert.equal(status, 200);
    return (body.activity as { type: string; details: any }[]).reverse();
  };

  return { id, grade, group, student, call, activity };
}

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

describe('GET /teacher/activity', () => {
  it('no session: 401', async () => {
    assert.equal((await request(null, 'GET', '/activity'))[0], 401);
  });

  it('a new teacher: an empty list', async () => {
    const t = await newTeacher('Empty');

    assert.deepEqual(await t.call('GET', '/activity'), [200, { activity: [] }]);
  });

  it('newest first, every field the card needs, cut by ?limit', async () => {
    const t = await newTeacher('Reader');
    for (const title of ['Quiz 1', 'Quiz 2', 'Quiz 3']) {
      await logActivity(pool, t.id, 'exam.added', {
        examId: '1',
        title,
        gradeName: 'Grade 1',
        heldOn: '2026-11-02',
      });
    }

    const [, body] = await t.call('GET', '/activity?limit=2');

    assert.deepEqual(
      body.activity.map((entry: { details: { title: string } }) => entry.details.title),
      ['Quiz 3', 'Quiz 2']
    );
    assert.deepEqual(Object.keys(body.activity[0]).sort(), ['createdAt', 'details', 'id', 'type']);
    assert.ok(!Number.isNaN(Date.parse(body.activity[0].createdAt)));
  });

  it('a bad limit is a 400', async () => {
    const t = await newTeacher('BadLimit');

    for (const limit of ['0', '-1', 'abc', '51', '']) {
      assert.equal((await t.call('GET', `/activity?limit=${limit}`))[0], 400, `limit=${limit}`);
    }
  });

  it('never shows another teacher’s activity', async () => {
    const t = await newTeacher('Private');
    const other = await newTeacher('Neighbour');
    await logActivity(pool, other.id, 'exam.added', {
      examId: '1',
      title: 'Theirs',
      gradeName: 'Grade 1',
      heldOn: '2026-11-02',
    });

    assert.deepEqual((await t.call('GET', '/activity'))[1].activity, []);
  });
});

describe('each action logs one entry with its facts', () => {
  it('adding a student: student.added', async () => {
    const t = await newTeacher('Adder');

    const [status, body] = await t.call('POST', `/grades/${t.grade}/students`, {
      fullName: 'Mariam Khaled',
      parentPhone: '01012345678',
      phone: null,
      groupId: t.group,
      notes: null,
    });
    assert.equal(status, 201);

    const [entry, ...rest] = await t.activity();
    assert.equal(rest.length, 0);
    assert.equal(entry?.type, 'student.added');
    assert.deepEqual(entry?.details, {
      studentId: body.student.id,
      studentName: 'Mariam Khaled',
      gradeName: 'Grade 1',
      groupName: 'Sat & Tue · 4 PM',
    });
  });

  it('recording a payment: payment.recorded; a double click (same requestId) logs once', async () => {
    const t = await newTeacher('Payer');
    const month = currentMonthInCairo();
    const payment = {
      requestId: randomUUID(),
      studentId: t.student,
      months: [month],
      amount: 350,
      paidOn: todayInCairo(),
      method: 'cash',
      note: null,
    };

    assert.equal((await t.call('POST', `/payments?month=${month}`, payment))[0], 200);
    assert.equal((await t.call('POST', `/payments?month=${month}`, payment))[0], 200);

    const entries = await t.activity();
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.type, 'payment.recorded');
    assert.deepEqual(entries[0]?.details, {
      studentId: t.student,
      studentName: 'Adam Mostafa',
      amount: 350,
      months: [month],
    });
  });

  it('voiding a payment: payment.voided with the reason; voiding twice logs once', async () => {
    const t = await newTeacher('Voider');
    const month = currentMonthInCairo();
    await t.call('POST', `/payments?month=${month}`, {
      requestId: randomUUID(),
      studentId: t.student,
      months: [month],
      amount: 350,
      paidOn: todayInCairo(),
      method: 'cash',
      note: null,
    });
    const { id: paymentId } = await one<{ id: string }>(
      'SELECT id::text AS id FROM payments WHERE student_id = $1',
      [t.student]
    );

    const reason = { reason: 'Recorded twice by mistake' };
    assert.equal((await t.call('POST', `/payments/${paymentId}/void?month=${month}`, reason))[0], 200);
    assert.equal((await t.call('POST', `/payments/${paymentId}/void?month=${month}`, reason))[0], 409);

    const entries = await t.activity();
    assert.deepEqual(
      entries.map((entry) => entry.type),
      ['payment.recorded', 'payment.voided']
    );
    assert.deepEqual(entries[1]?.details, {
      studentId: t.student,
      studentName: 'Adam Mostafa',
      amount: 350,
      reason: 'Recorded twice by mistake',
    });
  });

  it('taking attendance: attendance.taken (present + late); correcting the sheet later logs nothing new', async () => {
    const t = await newTeacher('Taker');
    const late = (
      await one<{ id: string }>(
        `
          INSERT INTO students (teacher_id, grade_id, group_id, full_name, code)
          VALUES ($1, $2, $3, 'Omar Tarek', 'A-2') RETURNING id::text AS id
        `,
        [t.id, t.grade, t.group]
      )
    ).id;
    const sheet = (status: string) => ({
      groupId: t.group,
      date: todayInCairo(),
      records: [
        { studentId: t.student, status, reason: null },
        { studentId: late, status: 'late', reason: null },
      ],
    });

    assert.equal((await t.call('PUT', '/attendance/sheet', sheet('absent')))[0], 200);
    assert.equal((await t.call('PUT', '/attendance/sheet', sheet('present')))[0], 200);

    const entries = await t.activity();
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.type, 'attendance.taken');
    // The first save's numbers: Omar was late (counts as present), Adam absent.
    assert.deepEqual(entries[0]?.details, {
      groupId: t.group,
      groupName: 'Sat & Tue · 4 PM',
      gradeName: 'Grade 1',
      day: todayInCairo(),
      present: 1,
      total: 2,
    });
  });

  it('adding an exam, then entering marks: exam.added, marks.entered', async () => {
    const t = await newTeacher('Examiner');
    await one(
      `
        INSERT INTO students (teacher_id, grade_id, group_id, full_name, code)
        VALUES ($1, $2, $3, 'Salma Hassan', 'A-3') RETURNING id
      `,
      [t.id, t.grade, t.group]
    );

    const [created, exam] = await t.call('POST', '/exams', {
      title: 'Quiz 4',
      kind: 'quiz',
      heldOn: todayInCairo(),
      maxMark: 20,
      passMark: 10,
      gradeId: t.grade,
    });
    assert.equal(created, 201);
    const examId = exam.exam.id;

    const [saved] = await t.call('PUT', `/exams/${examId}/results`, {
      results: [{ studentId: t.student, status: 'scored', score: 15 }],
    });
    assert.equal(saved, 200);

    const entries = await t.activity();
    assert.deepEqual(
      entries.map((entry) => [entry.type, entry.details]),
      [
        ['exam.added', { examId, title: 'Quiz 4', gradeName: 'Grade 1', heldOn: todayInCairo() }],
        ['marks.entered', { examId, title: 'Quiz 4', gradeName: 'Grade 1', entered: 1, total: 2 }],
      ]
    );
  });
});

describe('a refused action logs nothing', () => {
  it('a mark above "out of", a group from nowhere, a month before joining: no entries', async () => {
    const t = await newTeacher('Refused');
    const [, exam] = await t.call('POST', '/exams', {
      title: 'Quiz 5',
      kind: 'quiz',
      heldOn: todayInCairo(),
      maxMark: 20,
      passMark: 10,
      gradeId: t.grade,
    });
    const before = (await t.activity()).length; // the exam itself

    const marks = await t.call('PUT', `/exams/${exam.exam.id}/results`, {
      results: [{ studentId: t.student, status: 'scored', score: 25 }],
    });
    const student = await t.call('POST', `/grades/${t.grade}/students`, {
      fullName: 'Nobody',
      parentPhone: '01012345678',
      phone: null,
      groupId: '999999999',
      notes: null,
    });
    const payment = await t.call('POST', `/payments?month=${currentMonthInCairo()}`, {
      requestId: randomUUID(),
      studentId: t.student,
      months: ['2020-01'],
      amount: 350,
      paidOn: todayInCairo(),
      method: 'cash',
      note: null,
    });

    assert.deepEqual([marks[0], student[0], payment[0]], [400, 404, 400]);
    assert.equal((await t.activity()).length, before);
  });
});
