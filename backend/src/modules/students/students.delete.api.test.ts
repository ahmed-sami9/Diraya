// DELETE /teacher/students/:studentId — removing a student and everything of
// theirs. With payments, only when the request says so. Real app, real database.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

import app from '../../app';
import { pool } from '../../config/db';
import { getFrontendOrigin } from '../../config/frontendOrigin';
import { assertTestDatabase } from '../../test/assertTestDatabase';
import { currentMonthInCairo } from '../../utils/cairoDate';
import { AUTH_COOKIE_NAME } from '../auth/auth.cookie';
import { startTeacherSession } from '../auth/session/auth.session.service';
import { recordPayment, voidPayment } from '../payments/payments.repository';

const NOW = currentMonthInCairo();

let server: Server;
let baseUrl = '';
const teacherIds: string[] = [];

type Remove = (path: string, withCookie?: boolean) => Promise<[number, any]>;

async function one<T>(sql: string, params: unknown[]): Promise<T> {
  return (await pool.query(sql, params)).rows[0] as T;
}

async function signedInTeacher(name: string): Promise<{ id: string; remove: Remove }> {
  const { id } = await one<{ id: string }>(
    `INSERT INTO teachers (full_name, email) VALUES ($1, $2) RETURNING id::text AS id`,
    [name, `students-delete-${name}-${Date.now()}@example.com`]
  );
  teacherIds.push(id);
  const { token } = await startTeacherSession(id, false);

  const remove: Remove = async (path, withCookie = true) => {
    const response = await fetch(`${baseUrl}/api/v1/teacher/students/${path}`, {
      method: 'DELETE',
      headers: {
        origin: getFrontendOrigin(),
        ...(withCookie ? { cookie: `${AUTH_COOKIE_NAME}=${token}` } : {}),
      },
    });
    const text = await response.text();
    return [response.status, text ? JSON.parse(text) : null];
  };

  return { id, remove };
}

let A: Remove;
let B: Remove;
let teacherA = '';
let gradeId = '';
let groupId = '';
let counter = 0;

async function addStudent(name: string): Promise<string> {
  counter += 1;
  return (
    await one<{ id: string }>(
      `
        INSERT INTO students (teacher_id, grade_id, group_id, full_name, code, parent_phone)
        VALUES ($1, $2, $3, $4, $5, '01000000000')
        RETURNING id::text AS id
      `,
      [teacherA, gradeId, groupId, name, `DEL-${counter}`]
    )
  ).id;
}

async function pay(studentId: string, amount: number): Promise<string> {
  const outcome = await recordPayment(
    teacherA,
    {
      requestId: randomUUID(),
      studentId,
      months: [NOW],
      amount,
      paidOn: `${NOW}-01`,
      method: 'cash',
      note: null,
    },
    NOW
  );
  assert.equal(outcome.status, 'recorded');
  return outcome.status === 'recorded' ? outcome.paymentId : '';
}

const exists = async (studentId: string) =>
  ((await pool.query('SELECT 1 FROM students WHERE id = $1', [studentId])).rowCount ?? 0) > 0;

const lastActivity = async () =>
  one<{ type: string; details: any }>(
    `SELECT type, details FROM activity WHERE teacher_id = $1 ORDER BY id DESC LIMIT 1`,
    [teacherA]
  );

before(async () => {
  await assertTestDatabase();
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const a = await signedInTeacher('a');
  const b = await signedInTeacher('b');
  A = a.remove;
  B = b.remove;
  teacherA = a.id;

  gradeId = (
    await one<{ id: string }>(
      `INSERT INTO grades (teacher_id, name, monthly_fee) VALUES ($1, 'Grade 3', 200) RETURNING id::text AS id`,
      [teacherA]
    )
  ).id;
  groupId = (
    await one<{ id: string }>(
      `INSERT INTO groups (teacher_id, grade_id, name) VALUES ($1, $2, 'Group A') RETURNING id::text AS id`,
      [teacherA, gradeId]
    )
  ).id;
});

after(async () => {
  server.close();
  await pool.query('DELETE FROM teachers WHERE id = ANY ($1::bigint[])', [teacherIds]);
  await pool.end();
});

describe('a student with no payments', () => {
  it('is deleted with everything of theirs, and the grade comes back', async () => {
    const id = await addStudent('Mistake');
    await pool.query(
      `INSERT INTO student_notes (teacher_id, student_id, text) VALUES ($1, $2, 'hi')`,
      [teacherA, id]
    );

    const [status, body] = await A(id);

    assert.equal(status, 200);
    assert.deepEqual(body, { gradeId });
    assert.equal(await exists(id), false);
    const notes = await pool.query('SELECT 1 FROM student_notes WHERE student_id = $1', [id]);
    assert.equal(notes.rowCount, 0);
  });

  it('leaves a trace in recent activity', async () => {
    assert.deepEqual(await lastActivity(), {
      type: 'student.deleted',
      details: { studentName: 'Mistake', gradeName: 'Grade 3', paidTotal: 0 },
    });
  });

  it('voided payments alone don’t count as payments', async () => {
    const id = await addStudent('Voided');
    const paymentId = await pay(id, 200);
    assert.equal((await voidPayment(teacherA, paymentId, 'Wrong student')).status, 'voided');

    assert.equal((await A(id))[0], 200);
  });
});

describe('a student with payments', () => {
  let id = '';

  before(async () => {
    id = await addStudent('Paying');
    await pay(id, 150);
    await pay(id, 50);
  });

  it('without confirmation: 409 STUDENT_HAS_PAYMENTS, nothing deleted', async () => {
    const [status, body] = await A(id);

    assert.equal(status, 409);
    assert.equal(body.code, 'STUDENT_HAS_PAYMENTS');
    assert.equal(await exists(id), true);
  });

  it('with ?withPayments=true: deleted, payments too, and the amount is on record', async () => {
    const [status] = await A(`${id}?withPayments=true`);

    assert.equal(status, 200);
    assert.equal(await exists(id), false);
    const payments = await pool.query('SELECT 1 FROM payments WHERE student_id = $1', [id]);
    assert.equal(payments.rowCount, 0);
    assert.deepEqual((await lastActivity()).details, {
      studentName: 'Paying',
      gradeName: 'Grade 3',
      paidTotal: 200,
    });
  });
});

describe('refused', () => {
  it("another teacher's student, a malformed id, or one already gone: 404", async () => {
    const id = await addStudent('Theirs');

    for (const [call, path] of [
      [B, id],
      [A, 'abc'],
      [A, '999999999'],
    ] as const) {
      const [status, body] = await call(path);
      assert.equal(status, 404, path);
      assert.equal(body.code, 'STUDENT_NOT_FOUND', path);
    }
    assert.equal(await exists(id), true);
  });

  it('a confirmation that isn’t exactly "true": 400', async () => {
    const id = await addStudent('Odd');
    const [status, body] = await A(`${id}?withPayments=yes`);

    assert.equal(status, 400);
    assert.equal(body.code, 'INVALID_INPUT');
  });

  it('no session: 401', async () => {
    const id = await addStudent('Guarded');
    assert.equal((await A(id, false))[0], 401);
    assert.equal(await exists(id), true);
  });
});
