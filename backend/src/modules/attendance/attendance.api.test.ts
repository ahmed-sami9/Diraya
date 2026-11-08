// API tests for /api/v1/teacher/attendance: the pickers, the sheet, and
// saving it. Real database (diraya_test_db), real app.
//
// The rules that matter most: a save is all or nothing, saving twice
// changes nothing more, a teacher can only mark their own students of the
// session's grade, and a day that hasn't come yet can't be marked.

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

const PREFIX = 'attendance-api';

// Egypt's calendar days around today ("YYYY-MM-DD"), safe across month ends.
const shiftDay = (day: string, days: number) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const TODAY = todayInCairo();
const YESTERDAY = shiftDay(TODAY, -1);
const LAST_WEEK = shiftDay(TODAY, -7);
const TOMORROW = shiftDay(TODAY, 1);

let server: TestServer;
let A: SignedInTeacher;
let B: SignedInTeacher;

let gradeId = '';
let groupA = ''; // "Group 1", created with the grade
let groupB = '';
const st: Record<string, string> = {}; // student ids by first name
let otherGradeStudent = ''; // A's student in another grade
let bStudent = ''; // teacher B's student
let bGroup = '';

type Mark = { studentId: string; status: string; reason?: string | null };
const mark = (studentId: string, status: string, reason: string | null = null): Mark => ({
  studentId,
  status,
  reason,
});

const getSheet = (teacher: SignedInTeacher, groupId: string | null, date: string) =>
  teacher.call('GET', `/attendance/sheet?date=${date}${groupId ? `&groupId=${groupId}` : ''}`);

const putSheet = (teacher: SignedInTeacher, groupId: string, date: string, records: Mark[]) =>
  teacher.call('PUT', '/attendance/sheet', { groupId, date, records });

const sessionsOf = async (groupId: string) =>
  (
    await pool.query<{ id: string; held_on: string }>(
      `SELECT id::text AS id, held_on::text FROM class_sessions WHERE group_id = $1 ORDER BY held_on`,
      [groupId]
    )
  ).rows;

const recordsOf = async (groupId: string, day: string) =>
  (
    await pool.query<{ student_id: string; status: string; reason: string | null }>(
      `SELECT r.student_id::text, r.status, r.reason
       FROM attendance_records r JOIN class_sessions cs ON cs.id = r.session_id
       WHERE cs.group_id = $1 AND cs.held_on = $2::date
       ORDER BY r.student_id`,
      [groupId, day]
    )
  ).rows;

before(async () => {
  await assertTestDatabase();
  server = startTestServer();
  A = await signedInTeacher(server, PREFIX, 'Teacher A');
  B = await signedInTeacher(server, PREFIX, 'Teacher B');

  const grade = await A.call('POST', '/grades', { name: 'Grade 3', monthlyFee: 300 });
  gradeId = grade.body.grade.id;
  groupA = (await A.call('GET', `/grades/${gradeId}`)).body.groups[0].id;
  groupB = (await A.call('POST', `/grades/${gradeId}/groups`, { name: 'Group B' })).body.group.id;

  const addStudent = async (
    teacher: SignedInTeacher,
    grade: string,
    group: string,
    fullName: string
  ) => {
    const response = await teacher.call('POST', `/grades/${grade}/students`, {
      fullName,
      parentPhone: '01012345678',
      phone: null,
      groupId: group,
      notes: null,
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    return response.body.student.id as string;
  };

  st.omar = await addStudent(A, gradeId, groupA, 'Omar Adel');
  st.salma = await addStudent(A, gradeId, groupA, 'Salma Hany');
  st.adam = await addStudent(A, gradeId, groupA, 'Adam Samy');
  st.karim = await addStudent(A, gradeId, groupB, 'Karim Omran'); // the make-up student

  // They joined weeks ago, so they belong on past sheets too.
  await pool.query(
    `UPDATE students SET created_at = NOW() - INTERVAL '30 days' WHERE id = ANY ($1::bigint[])`,
    [Object.values(st)]
  );

  const otherGrade = (await A.call('POST', '/grades', { name: 'Grade 1', monthlyFee: 0 })).body
    .grade.id;
  const otherGroup = (await A.call('GET', `/grades/${otherGrade}`)).body.groups[0].id;
  otherGradeStudent = await addStudent(A, otherGrade, otherGroup, 'Nour Grade1');

  const bGrade = (await B.call('POST', '/grades', { name: 'Grade 3', monthlyFee: 300 })).body.grade
    .id;
  bGroup = (await B.call('GET', `/grades/${bGrade}`)).body.groups[0].id;
  bStudent = await addStudent(B, bGrade, bGroup, 'Hana B');
});

after(async () => {
  server.close();
  await pool.query(`DELETE FROM teachers WHERE email LIKE '${PREFIX}-%'`);
  await pool.end();
});

describe('GET /attendance/options', () => {
  it('lists the teacher’s grades with their groups, in the order they were made', async () => {
    const { status, body } = await A.call('GET', '/attendance/options');

    assert.equal(status, 200);
    assert.deepEqual(
      body.grades.map((g: any) => [g.name, g.groups.map((gr: any) => gr.name)]),
      [
        ['Grade 3', ['Group 1', 'Group B']],
        ['Grade 1', ['Group 1']],
      ]
    );
  });

  it('never shows another teacher’s grades', async () => {
    const { body } = await B.call('GET', '/attendance/options');

    assert.equal(body.grades.length, 1);
    assert.equal(body.grades[0].groups[0].id, bGroup);
  });
});

describe('GET /attendance/sheet', () => {
  it('shows the group’s students, unmarked, before anything is saved', async () => {
    const { status, body } = await getSheet(A, groupA, LAST_WEEK);

    assert.equal(status, 200);
    assert.equal(body.sheet.session, null);
    assert.deepEqual(body.sheet.group, { id: groupA, name: 'Group 1' });
    // Alphabetical, members only, nothing marked yet.
    assert.deepEqual(
      body.sheet.students.map((s: any) => [s.name, s.status, s.isMakeUp]),
      [
        ['Adam Samy', null, false],
        ['Omar Adel', null, false],
        ['Salma Hany', null, false],
      ]
    );
  });

  it('is read only: looking at a sheet never creates a class', async () => {
    await getSheet(A, groupA, LAST_WEEK);

    assert.deepEqual(await sessionsOf(groupA), []);
  });

  it('leaves out students who joined after that day', async () => {
    const late = await pool.query<{ id: string }>(
      `INSERT INTO students (teacher_id, grade_id, group_id, full_name, parent_phone, code)
       VALUES ($1, $2, $3, 'Zeina New', '01012345678', 'NEW-1') RETURNING id::text AS id`,
      [A.id, gradeId, groupA]
    );

    const lastWeek = await getSheet(A, groupA, LAST_WEEK);
    const today = await getSheet(A, groupA, TODAY);

    assert.ok(!lastWeek.body.sheet.students.some((s: any) => s.id === late.rows[0]!.id));
    assert.ok(today.body.sheet.students.some((s: any) => s.id === late.rows[0]!.id));

    await pool.query('DELETE FROM students WHERE id = $1', [late.rows[0]!.id]);
  });

  it('refuses a day that hasn’t come yet', async () => {
    const { status, body } = await getSheet(A, groupA, TOMORROW);

    assert.equal(status, 400);
    assert.equal(body.code, 'DATE_IN_FUTURE');
  });

  it('refuses a day that doesn’t exist', async () => {
    const { status, body } = await getSheet(A, groupA, '2026-02-30');

    assert.equal(status, 400);
    assert.equal(body.code, 'INVALID_INPUT');
  });

  it('answers 404 for another teacher’s group, without saying it exists', async () => {
    const { status, body } = await getSheet(B, groupA, TODAY);

    assert.equal(status, 404);
    assert.equal(body.code, 'GROUP_NOT_FOUND');
  });

  it('a teacher with no groups gets NO_GROUPS', async () => {
    const empty = await signedInTeacher(server, PREFIX, 'No Groups');
    const { status, body } = await getSheet(empty, null, TODAY);

    assert.equal(status, 404);
    assert.equal(body.code, 'NO_GROUPS');
  });
});

describe('PUT /attendance/sheet', () => {
  it('saves every mark and answers with the sheet as stored', async () => {
    const { status, body } = await putSheet(A, groupA, YESTERDAY, [
      mark(st.omar!, 'present'),
      mark(st.salma!, 'late'),
      mark(st.adam!, 'absent', '  sick  '),
    ]);

    assert.equal(status, 200);
    assert.ok(body.sheet.session.id);
    assert.deepEqual(
      body.sheet.students.map((s: any) => [s.name, s.status, s.reason]),
      [
        ['Adam Samy', 'absent', 'sick'],
        ['Omar Adel', 'present', null],
        ['Salma Hany', 'late', null],
      ]
    );
  });

  it('keeps a reason only for absent or excused, and stores "" as no reason', async () => {
    await putSheet(A, groupA, YESTERDAY, [
      mark(st.omar!, 'present', 'should be dropped'),
      mark(st.salma!, 'excused', ''),
      mark(st.adam!, 'absent', 'travelling'),
    ]);

    const reasons = Object.fromEntries(
      (await recordsOf(groupA, YESTERDAY)).map((r) => [r.student_id, r.reason])
    );
    assert.deepEqual(reasons, { [st.omar!]: null, [st.salma!]: null, [st.adam!]: 'travelling' });
  });

  it('saving the same sheet twice changes nothing more: one class, one activity entry', async () => {
    const sheet = [mark(st.omar!, 'present'), mark(st.salma!, 'present'), mark(st.adam!, 'late')];

    await putSheet(A, groupA, LAST_WEEK, sheet);
    const first = await recordsOf(groupA, LAST_WEEK);
    await putSheet(A, groupA, LAST_WEEK, sheet);

    assert.equal((await sessionsOf(groupA)).filter((s) => s.held_on === LAST_WEEK).length, 1);
    assert.deepEqual(await recordsOf(groupA, LAST_WEEK), first);

    const activity = await pool.query(
      `SELECT details FROM activity
       WHERE teacher_id = $1 AND type = 'attendance.taken' AND details->>'day' = $2`,
      [A.id, LAST_WEEK]
    );
    assert.equal(activity.rows.length, 1);
    // present counts present + late, the same rule as the attendance rate.
    assert.equal(activity.rows[0].details.present, 3);
    assert.equal(activity.rows[0].details.total, 3);
  });

  it('the sheet sent is the whole truth: a student left out loses their mark', async () => {
    await putSheet(A, groupA, LAST_WEEK, [mark(st.omar!, 'present'), mark(st.salma!, 'absent')]);

    assert.deepEqual(
      (await recordsOf(groupA, LAST_WEEK)).map((r) => r.student_id).sort(),
      [st.omar!, st.salma!].sort()
    );
  });

  it('a student from another group of the grade is saved as a make-up, listed after the group', async () => {
    const { status, body } = await putSheet(A, groupA, TODAY, [
      mark(st.omar!, 'present'),
      mark(st.salma!, 'present'),
      mark(st.adam!, 'present'),
      mark(st.karim!, 'present'),
    ]);

    assert.equal(status, 200);
    const last = body.sheet.students.at(-1);
    assert.equal(last.name, 'Karim Omran');
    assert.equal(last.isMakeUp, true);
    assert.equal(last.groupName, 'Group B');
  });

  it('a student from another grade is refused, and nothing is saved', async () => {
    const before = await recordsOf(groupA, YESTERDAY);

    const { status, body } = await putSheet(A, groupA, YESTERDAY, [
      mark(st.omar!, 'absent'),
      mark(otherGradeStudent, 'present'),
    ]);

    assert.equal(status, 404);
    assert.equal(body.code, 'STUDENT_NOT_FOUND');
    // All or nothing: Omar's change was rolled back with the rest.
    assert.deepEqual(await recordsOf(groupA, YESTERDAY), before);
  });

  it('another teacher’s student is refused the same way', async () => {
    const { status, body } = await putSheet(A, groupA, YESTERDAY, [mark(bStudent, 'present')]);

    assert.equal(status, 404);
    assert.equal(body.code, 'STUDENT_NOT_FOUND');
  });

  it('another teacher can’t save into this teacher’s group', async () => {
    const { status, body } = await putSheet(B, groupA, TODAY, [mark(bStudent, 'present')]);

    assert.equal(status, 404);
    assert.equal(body.code, 'GROUP_NOT_FOUND');
  });

  it('refuses a day that hasn’t come yet, and creates nothing', async () => {
    const { status, body } = await putSheet(A, groupA, TOMORROW, [mark(st.omar!, 'present')]);

    assert.equal(status, 400);
    assert.equal(body.code, 'DATE_IN_FUTURE');
    assert.ok(!(await sessionsOf(groupA)).some((s) => s.held_on === TOMORROW));
  });

  it('refuses a malformed sheet', async () => {
    const cases: unknown[] = [
      { groupId: groupA, date: TODAY, records: [] },
      { groupId: groupA, date: TODAY, records: [mark(st.omar!, 'here')] },
      {
        groupId: groupA,
        date: TODAY,
        records: [mark(st.omar!, 'present'), mark(st.omar!, 'absent')],
      },
      { groupId: 'abc', date: TODAY, records: [mark(st.omar!, 'present')] },
    ];

    for (const body of cases) {
      const response = await A.call('PUT', '/attendance/sheet', body);
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.equal(response.body.code, 'INVALID_INPUT');
    }
  });

  it('correcting a past day stamps editedAt; correcting today does not', async () => {
    const pastDay = shiftDay(TODAY, -3);
    const sheet = [mark(st.omar!, 'present')];

    const first = await putSheet(A, groupA, pastDay, sheet);
    assert.equal(first.body.sheet.session.editedAt, null);

    const again = await putSheet(A, groupA, pastDay, sheet);
    assert.ok(again.body.sheet.session.editedAt);

    // Today's sheet was saved above: saving it again is still "taking it", not editing.
    const today = await putSheet(A, groupA, TODAY, [mark(st.omar!, 'late')]);
    assert.equal(today.body.sheet.session.editedAt, null);
  });

  it('without a group, the sheet opens on the group taken most recently', async () => {
    await putSheet(A, groupB, TODAY, [mark(st.karim!, 'present')]);

    const { body } = await getSheet(A, null, TODAY);

    assert.equal(body.sheet.group.id, groupB);
  });
});
