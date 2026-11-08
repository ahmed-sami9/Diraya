// API tests for /api/v1/teacher/grades: create, list, edit, delete, and the
// numbers on each grade's card. Real database (diraya_test_db), real app.
//
// The rules that matter most: names are unique per teacher (whatever the
// capitals), a grade with students can't be deleted, and nobody can see or
// change another teacher's grades.

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { pool } from '../../config/db';
import { assertTestDatabase } from '../../test/assertTestDatabase';
import {
  signedInTeacher,
  startTestServer,
  type SignedInTeacher,
  type TestServer,
} from '../../test/api';
import { todayInCairo } from '../../utils/cairoDate';

const PREFIX = 'grades-api';

let server: TestServer;
let A: SignedInTeacher;
let B: SignedInTeacher;

const createGrade = (teacher: SignedInTeacher, name: string, monthlyFee = 250) =>
  teacher.call('POST', '/grades', { name, monthlyFee });

const addStudent = async (teacher: SignedInTeacher, gradeId: string, fullName: string) => {
  const groupId = (await teacher.call('GET', `/grades/${gradeId}`)).body.groups[0].id;
  const response = await teacher.call('POST', `/grades/${gradeId}/students`, {
    fullName,
    parentPhone: '01012345678',
    phone: null,
    groupId,
    notes: null,
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return { studentId: response.body.student.id as string, groupId: groupId as string };
};

before(async () => {
  await assertTestDatabase();
  server = startTestServer();
  A = await signedInTeacher(server, PREFIX, 'Teacher A');
  B = await signedInTeacher(server, PREFIX, 'Teacher B');
});

after(async () => {
  server.close();
  await pool.query(`DELETE FROM teachers WHERE email LIKE '${PREFIX}-%'`);
  await pool.end();
});

describe('POST /grades', () => {
  it('creates the grade with one group, "Group 1", and an empty card', async () => {
    const { status, body } = await createGrade(A, '  Grade 4  ', 400);

    assert.equal(status, 201);
    assert.deepEqual(body.grade, {
      id: body.grade.id,
      name: 'Grade 4',
      monthlyFee: 400,
      studentCount: 0,
      groupCount: 1,
      nextSession: null,
      lastSession: null,
    });

    const detail = await A.call('GET', `/grades/${body.grade.id}`);
    assert.deepEqual(
      detail.body.groups.map((g: any) => g.name),
      ['Group 1']
    );
  });

  it('refuses a name the teacher already uses, whatever the capitals', async () => {
    await createGrade(A, 'Grade 5');
    const { status, body } = await createGrade(A, 'GRADE 5');

    assert.equal(status, 409);
    assert.equal(body.code, 'GRADE_NAME_TAKEN');
  });

  it('two teachers can use the same name', async () => {
    const { status } = await createGrade(B, 'Grade 5');

    assert.equal(status, 201);
  });

  it('refuses bad data', async () => {
    const cases = [
      { name: '   ', monthlyFee: 100 },
      { name: 'x'.repeat(61), monthlyFee: 100 },
      { name: 'Grade', monthlyFee: -1 },
      { name: 'Grade', monthlyFee: 100_001 },
      { name: 'Grade', monthlyFee: 99.5 },
      { name: 'Grade', monthlyFee: '100' },
      { name: 'Grade' },
    ];

    for (const body of cases) {
      const response = await A.call('POST', '/grades', body);
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.equal(response.body.code, 'INVALID_INPUT');
    }
  });
});

describe('GET /grades', () => {
  it('lists only the teacher’s own grades, oldest first', async () => {
    const mine = (await A.call('GET', '/grades')).body.grades.map((g: any) => g.name);
    const theirs = (await B.call('GET', '/grades')).body.grades.map((g: any) => g.name);

    assert.deepEqual(mine, ['Grade 4', 'Grade 5']);
    assert.deepEqual(theirs, ['Grade 5']);
  });

  it('counts students and groups', async () => {
    const grade = (await createGrade(A, 'Counted')).body.grade;
    await addStudent(A, grade.id, 'Omar Adel');
    await addStudent(A, grade.id, 'Salma Hany');
    await A.call('POST', `/grades/${grade.id}/groups`, { name: 'Group 2' });

    const card = (await A.call('GET', `/grades/${grade.id}`)).body.grade;

    assert.equal(card.studentCount, 2);
    assert.equal(card.groupCount, 2);
  });

  it('shows the last class, counting late students as present', async () => {
    const grade = (await createGrade(A, 'With attendance')).body.grade;
    const omar = await addStudent(A, grade.id, 'Omar Adel');
    const salma = await addStudent(A, grade.id, 'Salma Hany');
    const adam = await addStudent(A, grade.id, 'Adam Samy');

    await A.call('PUT', '/attendance/sheet', {
      groupId: omar.groupId,
      date: todayInCairo(),
      records: [
        { studentId: omar.studentId, status: 'present', reason: null },
        { studentId: salma.studentId, status: 'late', reason: null },
        { studentId: adam.studentId, status: 'absent', reason: null },
      ],
    });

    const card = (await A.call('GET', `/grades/${grade.id}`)).body.grade;

    assert.equal(card.lastSession.groupName, 'Group 1');
    assert.equal(card.lastSession.presentCount, 2);
    assert.equal(card.lastSession.totalCount, 3);
  });
});

describe('PATCH /grades/:gradeId', () => {
  it('changes the name and fee', async () => {
    const grade = (await createGrade(A, 'Old name', 100)).body.grade;

    const { status, body } = await A.call('PATCH', `/grades/${grade.id}`, {
      name: 'New name',
      monthlyFee: 150,
    });

    assert.equal(status, 200);
    assert.equal(body.grade.name, 'New name');
    assert.equal(body.grade.monthlyFee, 150);
  });

  it('keeping its own name is fine; taking another grade’s name is not', async () => {
    const grade = (await createGrade(A, 'Keeps name')).body.grade;

    const same = await A.call('PATCH', `/grades/${grade.id}`, {
      name: 'Keeps name',
      monthlyFee: 1,
    });
    const taken = await A.call('PATCH', `/grades/${grade.id}`, { name: 'grade 4', monthlyFee: 1 });

    assert.equal(same.status, 200);
    assert.equal(taken.status, 409);
    assert.equal(taken.body.code, 'GRADE_NAME_TAKEN');
  });
});

describe('DELETE /grades/:gradeId', () => {
  it('deletes an empty grade and its groups', async () => {
    const grade = (await createGrade(A, 'To delete')).body.grade;

    const { status } = await A.call('DELETE', `/grades/${grade.id}`);

    assert.equal(status, 204);
    assert.equal((await A.call('GET', `/grades/${grade.id}`)).status, 404);
    const groups = await pool.query('SELECT 1 FROM groups WHERE grade_id = $1', [grade.id]);
    assert.equal(groups.rows.length, 0);
  });

  it('refuses while the grade has students, and keeps everything', async () => {
    const grade = (await createGrade(A, 'Has students')).body.grade;
    await addStudent(A, grade.id, 'Omar Adel');

    const { status, body } = await A.call('DELETE', `/grades/${grade.id}`);

    assert.equal(status, 409);
    assert.equal(body.code, 'GRADE_HAS_STUDENTS');
    assert.equal((await A.call('GET', `/grades/${grade.id}`)).body.grade.studentCount, 1);
  });

  it('deleting twice answers 404 the second time', async () => {
    const grade = (await createGrade(A, 'Twice')).body.grade;
    await A.call('DELETE', `/grades/${grade.id}`);

    const { status, body } = await A.call('DELETE', `/grades/${grade.id}`);

    assert.equal(status, 404);
    assert.equal(body.code, 'GRADE_NOT_FOUND');
  });
});

describe('another teacher’s grade', () => {
  it('is "not found" for every action, and stays unchanged', async () => {
    const grade = (await createGrade(A, 'Private', 500)).body.grade;

    const responses = [
      await B.call('GET', `/grades/${grade.id}`),
      await B.call('PATCH', `/grades/${grade.id}`, { name: 'Hacked', monthlyFee: 0 }),
      await B.call('DELETE', `/grades/${grade.id}`),
    ];

    for (const response of responses) {
      assert.equal(response.status, 404);
      assert.equal(response.body.code, 'GRADE_NOT_FOUND');
    }
    const after = (await A.call('GET', `/grades/${grade.id}`)).body.grade;
    assert.equal(after.name, 'Private');
    assert.equal(after.monthlyFee, 500);
  });

  it('an id that can’t exist is "not found", not a server error', async () => {
    for (const id of ['abc', '0', '-1', '1.5']) {
      const response = await A.call('GET', `/grades/${id}`);
      assert.equal(response.status, 404, id);
      assert.equal(response.body.code, 'GRADE_NOT_FOUND');
    }
  });
});
