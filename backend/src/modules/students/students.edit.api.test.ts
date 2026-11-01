// PATCH /teacher/students/:studentId — editing a student's name, phones and
// group. Real app, real database (diraya_test_db).

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

let server: Server;
let baseUrl = '';
const teacherIds: string[] = [];

type Patch = (studentId: string, body: unknown, withCookie?: boolean) => Promise<[number, any]>;

async function one<T>(sql: string, params: unknown[]): Promise<T> {
  return (await pool.query(sql, params)).rows[0] as T;
}

async function signedInTeacher(name: string): Promise<{ id: string; patch: Patch }> {
  const { id } = await one<{ id: string }>(
    `INSERT INTO teachers (full_name, email) VALUES ($1, $2) RETURNING id::text AS id`,
    [name, `students-edit-${name}-${Date.now()}@example.com`]
  );
  teacherIds.push(id);
  const { token } = await startTeacherSession(id, false);

  const patch: Patch = async (studentId, body, withCookie = true) => {
    const response = await fetch(`${baseUrl}/api/v1/teacher/students/${studentId}`, {
      method: 'PATCH',
      headers: {
        origin: getFrontendOrigin(),
        'content-type': 'application/json',
        ...(withCookie ? { cookie: `${AUTH_COOKIE_NAME}=${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    return [response.status, text ? JSON.parse(text) : null];
  };

  return { id, patch };
}

async function addGrade(teacherId: string, name: string, groupNames: string[]) {
  const grade = await one<{ id: string }>(
    `INSERT INTO grades (teacher_id, name, monthly_fee) VALUES ($1, $2, 200) RETURNING id::text AS id`,
    [teacherId, name]
  );
  const groups: string[] = [];
  for (const groupName of groupNames) {
    groups.push(
      (
        await one<{ id: string }>(
          `INSERT INTO groups (teacher_id, grade_id, name) VALUES ($1, $2, $3) RETURNING id::text AS id`,
          [teacherId, grade.id, groupName]
        )
      ).id
    );
  }
  return { gradeId: grade.id, groups };
}

let A: Patch;
let B: Patch;
let grade = { gradeId: '', groups: [] as string[] };
let otherGrade = { gradeId: '', groups: [] as string[] };
let otherTeacherGroup = '';
let studentId = '';

const details = (overrides: Record<string, unknown> = {}) => ({
  fullName: 'Omar Adel',
  parentPhone: '01012345678',
  phone: '01112345678',
  groupId: grade.groups[0],
  ...overrides,
});

before(async () => {
  await assertTestDatabase();
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const a = await signedInTeacher('a');
  const b = await signedInTeacher('b');
  A = a.patch;
  B = b.patch;

  grade = await addGrade(a.id, 'Grade 3', ['Sat 4 PM', 'Mon 6 PM']);
  otherGrade = await addGrade(a.id, 'Grade 1', ['Sun 2 PM']);
  otherTeacherGroup = (await addGrade(b.id, 'Grade 3', ['Theirs'])).groups[0]!;

  studentId = (
    await one<{ id: string }>(
      `
        INSERT INTO students (teacher_id, grade_id, group_id, full_name, code, parent_phone)
        VALUES ($1, $2, $3, 'Omar', 'ED-1', '01000000000')
        RETURNING id::text AS id
      `,
      [a.id, grade.gradeId, grade.groups[0]]
    )
  ).id;

  // One past session with the first group, to check a move keeps it.
  const session = await one<{ id: string }>(
    `
      INSERT INTO class_sessions (teacher_id, grade_id, group_id, held_on)
      VALUES ($1, $2, $3, '2026-10-10') RETURNING id::text AS id
    `,
    [a.id, grade.gradeId, grade.groups[0]]
  );
  await pool.query(
    `
      INSERT INTO attendance_records (session_id, student_id, grade_id, status, is_make_up)
      VALUES ($1, $2, $3, 'present', FALSE)
    `,
    [session.id, studentId, grade.gradeId]
  );
});

after(async () => {
  server.close();
  await pool.query('DELETE FROM teachers WHERE id = ANY ($1::bigint[])', [teacherIds]);
  await pool.end();
});

describe('editing a student', () => {
  it('saves name, phones and group, and answers with the updated profile', async () => {
    const [status, body] = await A(studentId, details({ groupId: grade.groups[1] }));

    assert.equal(status, 200);
    assert.equal(body.profile.name, 'Omar Adel');
    assert.equal(body.profile.parentPhone, '01012345678');
    assert.equal(body.profile.phone, '01112345678');
    assert.deepEqual(body.profile.group, { id: grade.groups[1], name: 'Mon 6 PM', sessions: [] });
    // The rest of the profile is still there.
    assert.equal(body.profile.code, 'ED-1');
    assert.equal(body.profile.summary.attendance.total, 1);
  });

  it('a move keeps past attendance with the group it happened in', async () => {
    const records = await pool.query<{ group_id: string }>(
      `
        SELECT cs.group_id::text AS group_id
        FROM attendance_records r JOIN class_sessions cs ON cs.id = r.session_id
        WHERE r.student_id = $1
      `,
      [studentId]
    );

    assert.deepEqual(records.rows, [{ group_id: grade.groups[0] }]);
  });

  it("removes the student's own phone with null", async () => {
    const [status, body] = await A(studentId, details({ phone: null }));

    assert.equal(status, 200);
    assert.equal(body.profile.phone, null);
  });

  it('tidies the name like Add does', async () => {
    const [, body] = await A(studentId, details({ fullName: '  Omar    Adel  Mahmoud ' }));

    assert.equal(body.profile.name, 'Omar Adel Mahmoud');
  });
});

describe('refused', () => {
  it('bad or missing data: 400 INVALID_INPUT', async () => {
    for (const body of [
      details({ parentPhone: '12345' }),
      details({ phone: '0101234567' }),
      details({ fullName: '   ' }),
      { fullName: 'Only a name' },
    ]) {
      const [status, response] = await A(studentId, body);
      assert.equal(status, 400, JSON.stringify(body));
      assert.equal(response.code, 'INVALID_INPUT');
    }
  });

  it("a group from another grade, or another teacher's: 404 GROUP_NOT_FOUND", async () => {
    for (const groupId of [otherGrade.groups[0], otherTeacherGroup]) {
      const [status, body] = await A(studentId, details({ groupId }));
      assert.equal(status, 404, groupId);
      assert.equal(body.code, 'GROUP_NOT_FOUND');
    }
  });

  it('a refused edit changes nothing', async () => {
    await A(studentId, details({ fullName: 'Changed', groupId: otherGrade.groups[0] }));
    const { full_name } = await one<{ full_name: string }>(
      'SELECT full_name FROM students WHERE id = $1',
      [studentId]
    );

    assert.notEqual(full_name, 'Changed');
  });

  it("another teacher's student, or a malformed id: 404 STUDENT_NOT_FOUND", async () => {
    const [status, body] = await B(studentId, details({ groupId: otherTeacherGroup }));
    assert.equal(status, 404);
    assert.equal(body.code, 'STUDENT_NOT_FOUND');

    const [badStatus, badBody] = await A('abc', details());
    assert.equal(badStatus, 404);
    assert.equal(badBody.code, 'STUDENT_NOT_FOUND');
  });

  it('no session: 401', async () => {
    assert.equal((await A(studentId, details(), false))[0], 401);
  });
});
