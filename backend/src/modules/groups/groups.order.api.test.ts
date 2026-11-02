// PUT /teacher/groups/:groupId/student-order — the teacher's own order of a
// group's students, and how it reads back on the grade page. Real database.

import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, beforeEach, describe, it } from 'node:test';

import app from '../../app';
import { pool } from '../../config/db';
import { getFrontendOrigin } from '../../config/frontendOrigin';
import { assertTestDatabase } from '../../test/assertTestDatabase';
import { AUTH_COOKIE_NAME } from '../auth/auth.cookie';
import { startTeacherSession } from '../auth/session/auth.session.service';

let server: Server;
let baseUrl = '';
const teacherIds: string[] = [];

type Call = (
  method: string,
  path: string,
  body?: unknown,
  withCookie?: boolean
) => Promise<[number, any]>;

async function one<T>(sql: string, params: unknown[]): Promise<T> {
  return (await pool.query(sql, params)).rows[0] as T;
}

async function signedInTeacher(name: string): Promise<{ id: string; call: Call }> {
  const { id } = await one<{ id: string }>(
    `INSERT INTO teachers (full_name, email) VALUES ($1, $2) RETURNING id::text AS id`,
    [name, `groups-order-${name}-${Date.now()}@example.com`]
  );
  teacherIds.push(id);
  const { token } = await startTeacherSession(id, false);

  const call: Call = async (method, path, body, withCookie = true) => {
    const response = await fetch(`${baseUrl}/api/v1/teacher${path}`, {
      method,
      headers: {
        origin: getFrontendOrigin(),
        ...(withCookie ? { cookie: `${AUTH_COOKIE_NAME}=${token}` } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? null : JSON.stringify(body),
    });
    const text = await response.text();
    return [response.status, text ? JSON.parse(text) : null];
  };

  return { id, call };
}

let A: Call;
let B: Call;
let teacherA = '';
let gradeId = '';
let groupA = '';
let groupB = '';
const ids: Record<string, string> = {};

const order = (studentIds: string[]) => A('PUT', `/groups/${groupA}/student-order`, { studentIds });

// The grade page's rows for group A, in the order "My order" shows them:
// placed first by position, then the unplaced by name.
async function groupRows() {
  const [, body] = await A('GET', `/grades/${gradeId}/students`);
  return body.students
    .filter((s: any) => s.groupId === groupA)
    .sort(
      (a: any, b: any) =>
        (a.position ?? Infinity) - (b.position ?? Infinity) || a.name.localeCompare(b.name)
    )
    .map((s: any) => [s.name, s.position]);
}

before(async () => {
  await assertTestDatabase();
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const a = await signedInTeacher('a');
  const b = await signedInTeacher('b');
  A = a.call;
  B = b.call;
  teacherA = a.id;

  gradeId = (
    await one<{ id: string }>(
      `INSERT INTO grades (teacher_id, name, monthly_fee) VALUES ($1, 'Grade 3', 200) RETURNING id::text AS id`,
      [teacherA]
    )
  ).id;
  for (const name of ['A', 'B']) {
    const { id } = await one<{ id: string }>(
      `INSERT INTO groups (teacher_id, grade_id, name) VALUES ($1, $2, $3) RETURNING id::text AS id`,
      [teacherA, gradeId, `Group ${name}`]
    );
    if (name === 'A') groupA = id;
    else groupB = id;
  }
});

beforeEach(async () => {
  // Three students in group A, one in group B, none placed.
  await pool.query('DELETE FROM students WHERE teacher_id = $1', [teacherA]);
  for (const [name, group] of [
    ['Mona', groupA],
    ['Adam', groupA],
    ['Sara', groupA],
    ['Omar', groupB],
  ] as const) {
    ids[name] = (
      await one<{ id: string }>(
        `
          INSERT INTO students (teacher_id, grade_id, group_id, full_name, code, parent_phone)
          VALUES ($1, $2, $3, $4, $5, '01000000000') RETURNING id::text AS id
        `,
        [teacherA, gradeId, group, name, `OR-${name}-${Date.now() % 100000}`]
      )
    ).id;
  }
});

after(async () => {
  server.close();
  await pool.query('DELETE FROM teachers WHERE id = ANY ($1::bigint[])', [teacherIds]);
  await pool.end();
});

describe('saving an order', () => {
  it('never ordered: everyone unplaced, so by name', async () => {
    assert.deepEqual(await groupRows(), [
      ['Adam', null],
      ['Mona', null],
      ['Sara', null],
    ]);
  });

  it('saves the order given, 0, 1, 2…', async () => {
    const [status] = await order([ids.Sara!, ids.Mona!, ids.Adam!]);

    assert.equal(status, 204);
    assert.deepEqual(await groupRows(), [
      ['Sara', 0],
      ['Mona', 1],
      ['Adam', 2],
    ]);
  });

  it('a student added to an ordered group goes to the end', async () => {
    await order([ids.Sara!, ids.Mona!, ids.Adam!]);
    const [status] = await A('POST', `/grades/${gradeId}/students`, {
      fullName: 'Zeina New',
      parentPhone: '01012345678',
      phone: null,
      groupId: groupA,
      notes: null,
    });

    assert.equal(status, 201);
    assert.deepEqual((await groupRows()).at(-1), ['Zeina New', 3]);
  });

  it('a student added to a never-ordered group stays unplaced', async () => {
    const [, body] = await A('POST', `/grades/${gradeId}/students`, {
      fullName: 'Basma',
      parentPhone: '01012345678',
      phone: null,
      groupId: groupA,
      notes: null,
    });

    assert.equal(body.student.position, null);
  });

  it('moving to another group loses the old place', async () => {
    await order([ids.Sara!, ids.Mona!, ids.Adam!]);
    await A('PATCH', `/students/${ids.Sara}`, {
      fullName: 'Sara',
      parentPhone: '01000000000',
      phone: null,
      groupId: groupB,
    });
    const [, body] = await A('GET', `/grades/${gradeId}/students`);

    assert.equal(body.students.find((s: any) => s.id === ids.Sara).position, null);
  });

  it('editing without moving keeps the place', async () => {
    await order([ids.Sara!, ids.Mona!, ids.Adam!]);
    await A('PATCH', `/students/${ids.Mona}`, {
      fullName: 'Mona Renamed',
      parentPhone: '01000000000',
      phone: null,
      groupId: groupA,
    });

    assert.deepEqual((await groupRows())[1], ['Mona Renamed', 1]);
  });
});

describe('refused', () => {
  it('a list that isn’t exactly the group: 409 ORDER_OUT_OF_DATE, nothing saved', async () => {
    for (const studentIds of [
      [ids.Sara!, ids.Mona!], // one missing
      [ids.Sara!, ids.Mona!, ids.Adam!, ids.Omar!], // one from another group
      [ids.Sara!, ids.Mona!, '999999999'], // one that doesn't exist
    ]) {
      const [status, body] = await order(studentIds);
      assert.equal(status, 409, JSON.stringify(studentIds));
      assert.equal(body.code, 'ORDER_OUT_OF_DATE');
    }
    assert.deepEqual(
      (await groupRows()).map(([, position]: any) => position),
      [null, null, null]
    );
  });

  it('duplicates, an empty list or bad ids: 400 INVALID_INPUT', async () => {
    for (const studentIds of [[ids.Sara!, ids.Sara!, ids.Mona!], [], ['abc']]) {
      const [status, body] = await order(studentIds);
      assert.equal(status, 400, JSON.stringify(studentIds));
      assert.equal(body.code, 'INVALID_INPUT');
    }
  });

  it("another teacher's group, or a malformed id: 404 GROUP_NOT_FOUND", async () => {
    const [status, body] = await B('PUT', `/groups/${groupA}/student-order`, {
      studentIds: [ids.Sara, ids.Mona, ids.Adam],
    });
    assert.equal(status, 404);
    assert.equal(body.code, 'GROUP_NOT_FOUND');

    assert.equal((await A('PUT', '/groups/abc/student-order', { studentIds: [ids.Sara] }))[0], 404);
  });

  it('no session: 401', async () => {
    const [status] = await A(
      'PUT',
      `/groups/${groupA}/student-order`,
      { studentIds: [ids.Sara] },
      false
    );
    assert.equal(status, 401);
  });
});
