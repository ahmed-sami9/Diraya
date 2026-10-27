// GET /teacher/home through HTTP, plus the month rule its numbers rely on.
// Real database (diraya_test_db), real app.

import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

import app from '../../app';
import { pool } from '../../config/db';
import { getFrontendOrigin } from '../../config/frontendOrigin';
import { assertTestDatabase } from '../../test/assertTestDatabase';
import { AUTH_COOKIE_NAME } from '../auth/auth.cookie';
import { startTeacherSession } from '../auth/session/auth.session.service';
import { countStudents } from '../students/students.repository';

let server: Server;
let baseUrl = '';
const teacherIds: string[] = [];

async function getHome(token: string | null): Promise<[number, any]> {
  const response = await fetch(`${baseUrl}/api/v1/teacher/home`, {
    headers: {
      origin: getFrontendOrigin(),
      ...(token ? { cookie: `${AUTH_COOKIE_NAME}=${token}` } : {}),
    },
  });
  const text = await response.text();
  return [response.status, text ? JSON.parse(text) : null];
}

async function newTeacher(name: string) {
  const { id } = (
    await pool.query<{ id: string }>(
      `INSERT INTO teachers (full_name, email) VALUES ($1, $2) RETURNING id::text AS id`,
      [name, `home-api-${name}-${Date.now()}@example.com`]
    )
  ).rows[0]!;
  teacherIds.push(id);

  const grade = (
    await pool.query<{ id: string }>(
      `INSERT INTO grades (teacher_id, name, monthly_fee) VALUES ($1, 'Grade 1', 0) RETURNING id::text AS id`,
      [id]
    )
  ).rows[0]!.id;
  const group = (
    await pool.query<{ id: string }>(
      `INSERT INTO groups (teacher_id, grade_id, name) VALUES ($1, $2, 'A') RETURNING id::text AS id`,
      [id, grade]
    )
  ).rows[0]!.id;

  const { token } = await startTeacherSession(id, false);
  let code = 0;

  // `createdAt`: an SQL expression for when the student was added.
  const addStudent = (createdAt: string) =>
    pool.query(
      `
        INSERT INTO students (teacher_id, grade_id, group_id, full_name, code, created_at)
        VALUES ($1, $2, $3, 'Student', $4, ${createdAt})
      `,
      [id, grade, group, `H-${++code}`]
    );

  return { id, token, addStudent };
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

describe('GET /teacher/home', () => {
  it('no session: 401', async () => {
    assert.equal((await getHome(null))[0], 401);
  });

  it('a brand-new teacher gets zeros, not an error', async () => {
    const t = await newTeacher('Empty');

    const [status, body] = await getHome(t.token);

    assert.equal(status, 200);
    assert.deepEqual(body, { summary: { students: { total: 0, joinedThisMonth: 0 } } });
  });

  it('counts all of this teacher’s students, and who joined this month', async () => {
    const t = await newTeacher('Counted');
    const other = await newTeacher('Other');

    for (let i = 0; i < 3; i++) await t.addStudent(`NOW() - INTERVAL '70 days'`);
    for (let i = 0; i < 2; i++) await t.addStudent(`NOW() - INTERVAL '1 minute'`);
    // Another teacher's students are never counted.
    for (let i = 0; i < 4; i++) await other.addStudent(`NOW() - INTERVAL '1 minute'`);

    const [, body] = await getHome(t.token);

    assert.deepEqual(body.summary.students, { total: 5, joinedThisMonth: 2 });
  });
});

describe('countStudents (repository)', () => {
  it('uses Egypt’s calendar: 01:30 on 1 October in Cairo is October, though UTC still says 30 September', async () => {
    const t = await newTeacher('Midnight');
    // 22:30 UTC on 30 Sep = 01:30 on 1 Oct in Cairo (UTC+3 then).
    await t.addStudent(`TIMESTAMPTZ '2026-09-30 22:30:00+00'`);

    assert.equal((await countStudents(t.id, '2026-10')).joined_in_month, 1);
    assert.equal((await countStudents(t.id, '2026-09')).joined_in_month, 0);
  });
});
