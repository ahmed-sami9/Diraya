// Tests for the exams migration (the database's own rules) and the
// repository (the SQL). They run against the real local database, because
// that's where the rules live: a mock can't tell you a CHECK works.
//
// Run:  npx tsx --test src/modules/exams/exams.repository.test.ts
//
// Each run creates its own teachers and deletes them at the end. Deleting a
// teacher cascades to everything they own, so nothing is left behind (and
// that cascade is tested too).

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { pool } from '../../config/db';
import { isCheckViolation } from '../../errors/pgErrors';

import * as repo from './exams.repository';

// Fixed days, so the tests mean the same thing on any date.
const TODAY = '2026-10-17';
const PAST = '2026-10-08';
const FUTURE = '2026-10-25';

const run = Date.now();
let teacherA = '';
let teacherB = '';
let grade3 = ''; // teacher A
let grade1 = ''; // teacher A, another grade
let gradeB = ''; // teacher B
let groupA = '';
let groupB = '';
let group1 = '';
const s: Record<string, string> = {}; // students by short name

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const result = await pool.query(sql, params);
  return result.rows[0] as T;
}

async function addTeacher(name: string) {
  const row = await one<{ id: string }>(
    `INSERT INTO teachers (full_name, email) VALUES ($1, $2) RETURNING id::text AS id`,
    [name, `exams-test-${name}-${run}@example.com`]
  );
  return row.id;
}

async function addGrade(teacherId: string, name: string) {
  return (
    await one<{ id: string }>(
      `INSERT INTO grades (teacher_id, name) VALUES ($1, $2) RETURNING id::text AS id`,
      [teacherId, name]
    )
  ).id;
}

async function addGroup(teacherId: string, gradeId: string, name: string) {
  return (
    await one<{ id: string }>(
      `INSERT INTO groups (teacher_id, grade_id, name) VALUES ($1, $2, $3) RETURNING id::text AS id`,
      [teacherId, gradeId, name]
    )
  ).id;
}

// joinedOn: the student's created_at, as a day in Egypt (noon, to be safe).
async function addStudent(
  teacherId: string,
  gradeId: string,
  groupId: string,
  name: string,
  joinedOn = '2026-09-01'
) {
  return (
    await one<{ id: string }>(
      `
        INSERT INTO students (teacher_id, grade_id, group_id, full_name, code, created_at)
        VALUES ($1, $2, $3, $4, $5, ($6::date + TIME '12:00') AT TIME ZONE 'Africa/Cairo')
        RETURNING id::text AS id
      `,
      [teacherId, gradeId, groupId, name, `T-${name.slice(0, 6)}-${run % 100000}`, joinedOn]
    )
  ).id;
}

const exam = (overrides: Partial<repo.ExamInput> = {}): repo.ExamInput => ({
  title: 'Unit 3 test',
  kind: 'exam',
  heldOn: PAST,
  maxMark: 40,
  passMark: 20,
  ...overrides,
});

async function newExam(overrides: Partial<repo.ExamInput> = {}, gradeId = grade3) {
  const id = await repo.insertExam(teacherA, gradeId, exam(overrides));
  assert.ok(id, 'exam was created');
  return id;
}

// Runs raw SQL that must fail, and returns the error.
async function expectSqlError(sql: string, params: unknown[]) {
  try {
    await pool.query(sql, params);
  } catch (error) {
    return error as { code: string; constraint: string };
  }
  assert.fail('expected the database to refuse this');
}

before(async () => {
  teacherA = await addTeacher('a');
  teacherB = await addTeacher('b');

  grade3 = await addGrade(teacherA, 'Grade 3');
  grade1 = await addGrade(teacherA, 'Grade 1');
  gradeB = await addGrade(teacherB, 'Other teacher grade');

  groupA = await addGroup(teacherA, grade3, 'Group A');
  groupB = await addGroup(teacherA, grade3, 'Group B');
  group1 = await addGroup(teacherA, grade1, 'Group 1');
  const groupOther = await addGroup(teacherB, gradeB, 'Group X');

  s.omar = await addStudent(teacherA, grade3, groupA, 'Omar Adel');
  s.salma = await addStudent(teacherA, grade3, groupA, 'Salma Hany');
  s.hassan = await addStudent(teacherA, grade3, groupA, 'Hassan Ali');
  s.karim = await addStudent(teacherA, grade3, groupB, 'Karim Omran');
  s.laila = await addStudent(teacherA, grade3, groupB, 'Laila Ahmed');
  // Joined AFTER the past exam: not on it (unless they get a result).
  s.late = await addStudent(teacherA, grade3, groupB, 'Zeina Late', '2026-10-12');
  s.grade1 = await addStudent(teacherA, grade1, group1, 'Nour Grade1');
  s.other = await addStudent(teacherB, gradeB, groupOther, 'Other Teacher Kid');
});

after(async () => {
  // Deleting the teachers must clean up everything (tested below too).
  await pool.query('DELETE FROM teachers WHERE id = ANY ($1::bigint[])', [[teacherA, teacherB]]);
  await pool.end();
});

/* ----------------------------- Database rules ----------------------------- */

describe('migration: rules on exams', () => {
  const insert = (kind: string, max: number, pass: number, title = 'T') =>
    expectSqlError(
      `INSERT INTO exams (teacher_id, grade_id, title, kind, held_on, max_mark, pass_mark)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [teacherA, grade3, title, kind, PAST, max, pass]
    );

  it('refuses an unknown kind', async () => {
    assert.equal((await insert('final', 40, 20)).constraint, 'exams_kind_check');
  });

  it('refuses "out of" outside 1..1000', async () => {
    assert.equal((await insert('exam', 0, 0.5)).constraint, 'exams_max_mark_check');
    assert.equal((await insert('exam', 1001, 20)).constraint, 'exams_max_mark_check');
  });

  it('refuses a pass mark above "out of", zero, or not a half', async () => {
    assert.equal((await insert('exam', 40, 41)).constraint, 'exams_pass_mark_check');
    assert.equal((await insert('exam', 40, 0)).constraint, 'exams_pass_mark_check');
    assert.equal((await insert('exam', 40, 20.3)).constraint, 'exams_pass_mark_check');
  });

  it('refuses a blank title', async () => {
    assert.equal((await insert('exam', 40, 20, '   ')).constraint, 'exams_title_not_blank');
  });
});

describe('migration: rules on exam_results', () => {
  let examId = '';
  before(async () => {
    examId = await newExam({ title: 'Rules exam' });
  });

  const insert = (studentId: string, gradeId: string, status: string, score: number | null) =>
    expectSqlError(
      `INSERT INTO exam_results (exam_id, student_id, grade_id, max_mark, status, score)
       VALUES ($1, $2, $3, 40, $4, $5)`,
      [examId, studentId, gradeId, status, score]
    );

  it('refuses "scored" without a score, and "absent" with one', async () => {
    assert.equal(
      (await insert(s.omar!, grade3, 'scored', null)).constraint,
      'exam_results_status_score_check'
    );
    assert.equal(
      (await insert(s.omar!, grade3, 'absent', 30)).constraint,
      'exam_results_status_score_check'
    );
  });

  it('refuses a score above "out of", below 0, or not a half', async () => {
    assert.equal(
      (await insert(s.omar!, grade3, 'scored', 41)).constraint,
      'exam_results_score_check'
    );
    assert.equal(
      (await insert(s.omar!, grade3, 'scored', -1)).constraint,
      'exam_results_score_check'
    );
    assert.equal(
      (await insert(s.omar!, grade3, 'scored', 30.25)).constraint,
      'exam_results_score_check'
    );
  });

  it('refuses a student of another grade (composite foreign keys)', async () => {
    // Claiming the exam's grade: the student isn't in it.
    const asExamGrade = await insert(s.grade1!, grade3, 'scored', 30);
    assert.equal(asExamGrade.constraint, 'exam_results_student_fkey');
    // Claiming the student's grade: the exam isn't in it.
    const asStudentGrade = await insert(s.grade1!, grade1, 'scored', 30);
    assert.equal(asStudentGrade.constraint, 'exam_results_exam_fkey');
  });

  it('refuses a max_mark that differs from the exam', async () => {
    const error = await expectSqlError(
      `INSERT INTO exam_results (exam_id, student_id, grade_id, max_mark, status, score)
       VALUES ($1, $2, $3, 50, 'scored', 45)`,
      [examId, s.omar, grade3]
    );
    assert.equal(error.constraint, 'exam_results_max_mark_fkey');
  });

  it('allows one result per student per exam', async () => {
    await pool.query(
      `INSERT INTO exam_results (exam_id, student_id, grade_id, max_mark, status, score)
       VALUES ($1, $2, $3, 40, 'scored', 30)`,
      [examId, s.omar, grade3]
    );
    const duplicate = await insert(s.omar!, grade3, 'scored', 31);
    assert.equal(duplicate.constraint, 'exam_results_pkey');
  });
});

describe('migration: "out of" stays in sync (ON UPDATE CASCADE)', () => {
  let examId = '';
  before(async () => {
    examId = await newExam({ title: 'Cascade exam' });
    await repo.saveResults(
      teacherA,
      examId,
      [{ studentId: s.omar!, status: 'scored', score: 35 }],
      TODAY
    );
  });

  it('raising "out of" updates the copy in every result', async () => {
    await pool.query('UPDATE exams SET max_mark = 50 WHERE id = $1', [examId]);
    const row = await one<{ max_mark: number }>(
      'SELECT max_mark FROM exam_results WHERE exam_id = $1',
      [examId]
    );
    assert.equal(row.max_mark, 50);
  });

  it('lowering "out of" below a saved score fails as a whole', async () => {
    const error = await expectSqlError('UPDATE exams SET max_mark = 30 WHERE id = $1', [examId]);
    assert.ok(isCheckViolation(error, 'exam_results_score_check'), JSON.stringify(error));

    const after = await one<{ max_mark: number }>('SELECT max_mark FROM exams WHERE id = $1', [
      examId,
    ]);
    assert.equal(after.max_mark, 50, 'the exam kept its old "out of"');
  });
});

describe('migration: deletes', () => {
  it('deleting an exam deletes its results', async () => {
    const examId = await newExam({ title: 'To delete' });
    await repo.saveResults(teacherA, examId, [{ studentId: s.omar!, status: 'absent' }], TODAY);
    await pool.query('DELETE FROM exams WHERE id = $1', [examId]);
    const left = await one<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM exam_results WHERE exam_id = $1',
      [examId]
    );
    assert.equal(left.n, 0);
  });

  it('deleting a student deletes their results', async () => {
    const examId = await newExam({ title: 'Student delete' });
    const temp = await addStudent(teacherA, grade3, groupA, 'Temp Student');
    await repo.saveResults(
      teacherA,
      examId,
      [{ studentId: temp, status: 'scored', score: 10 }],
      TODAY
    );
    await pool.query('DELETE FROM students WHERE id = $1', [temp]);
    const left = await one<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM exam_results WHERE student_id = $1',
      [temp]
    );
    assert.equal(left.n, 0);
  });

  it('deleting an empty grade deletes its exams', async () => {
    const emptyGrade = await addGrade(teacherA, 'Empty grade');
    const examId = await newExam({ title: 'Empty grade exam' }, emptyGrade);
    await pool.query('DELETE FROM grades WHERE id = $1', [emptyGrade]);
    assert.equal(await repo.findExam(teacherA, examId), null);
  });

  it('deleting a teacher (demo clean-up) removes their exams and results', async () => {
    const t = await addTeacher('c');
    const g = await addGrade(t, 'G');
    const gr = await addGroup(t, g, 'Group 1');
    const st = await addStudent(t, g, gr, 'Kid C');
    const examId = await repo.insertExam(t, g, exam());
    await repo.saveResults(t, examId!, [{ studentId: st, status: 'scored', score: 20 }], TODAY);

    await pool.query('DELETE FROM teachers WHERE id = $1', [t]);

    const left = await one<{ n: number }>(
      `SELECT (SELECT COUNT(*) FROM exams WHERE teacher_id = $1)
            + (SELECT COUNT(*) FROM exam_results WHERE exam_id = $2) AS n`,
      [t, examId]
    );
    assert.equal(Number(left.n), 0);
  });
});

/* ------------------------------- Repository ------------------------------- */

describe('insertExam', () => {
  it('adds an exam to the teacher’s own grade', async () => {
    const id = await newExam({ title: 'Insert ok', passMark: 20.5 });
    const row = await repo.findExam(teacherA, id);
    assert.deepEqual(
      { ...row, id: undefined },
      {
        id: undefined,
        title: 'Insert ok',
        kind: 'exam',
        held_on: PAST,
        max_mark: 40,
        pass_mark: 20.5,
        grade_id: grade3,
        grade_name: 'Grade 3',
      }
    );
  });

  it('returns null for another teacher’s grade (and inserts nothing)', async () => {
    assert.equal(await repo.insertExam(teacherA, gradeB, exam()), null);
  });
});

describe('findExam / deleteExam: ownership', () => {
  it('another teacher can’t read or delete it', async () => {
    const id = await newExam({ title: 'Mine' });
    assert.equal(await repo.findExam(teacherB, id), null);
    assert.deepEqual(await repo.findExamResults(teacherB, id), []);
    assert.equal(await repo.deleteExam(teacherB, id), false);
    assert.ok(await repo.findExam(teacherA, id), 'still there');
    assert.equal(await repo.deleteExam(teacherA, id), true);
  });
});

describe('saveResults', () => {
  let examId = '';
  before(async () => {
    examId = await newExam({ title: 'Save exam' });
  });

  const results = async () =>
    Object.fromEntries(
      (await repo.findExamResults(teacherA, examId)).map((r) => [
        r.student_name,
        r.status === null ? '—' : r.status === 'absent' ? 'A' : r.score,
      ])
    );

  it('saves marks and absences', async () => {
    const outcome = await repo.saveResults(
      teacherA,
      examId,
      [
        { studentId: s.omar!, status: 'scored', score: 40 },
        { studentId: s.salma!, status: 'absent' },
        { studentId: s.hassan!, status: 'scored', score: 18.5 },
      ],
      TODAY
    );
    assert.deepEqual(outcome, { status: 'saved' });
    assert.deepEqual(await results(), {
      'Hassan Ali': 18.5,
      'Karim Omran': '—',
      'Laila Ahmed': '—',
      'Omar Adel': 40,
      'Salma Hany': 'A',
    });
  });

  it('only touches the students listed', async () => {
    await repo.saveResults(
      teacherA,
      examId,
      [{ studentId: s.karim!, status: 'scored', score: 27 }],
      TODAY
    );
    const now = await results();
    assert.equal(now['Omar Adel'], 40, 'Omar untouched');
    assert.equal(now['Karim Omran'], 27);
  });

  it('is idempotent: saving the same thing twice changes nothing', async () => {
    const before = await results();
    const same: repo.ResultToSave[] = [{ studentId: s.karim!, status: 'scored', score: 27 }];
    await repo.saveResults(teacherA, examId, same, TODAY);
    await repo.saveResults(teacherA, examId, same, TODAY);
    assert.deepEqual(await results(), before);
  });

  it('changes a mark to absent and back', async () => {
    await repo.saveResults(teacherA, examId, [{ studentId: s.karim!, status: 'absent' }], TODAY);
    assert.equal((await results())['Karim Omran'], 'A');
    await repo.saveResults(
      teacherA,
      examId,
      [{ studentId: s.karim!, status: 'scored', score: 30 }],
      TODAY
    );
    assert.equal((await results())['Karim Omran'], 30);
  });

  it('"not-entered" clears a saved result', async () => {
    await repo.saveResults(
      teacherA,
      examId,
      [{ studentId: s.karim!, status: 'not-entered' }],
      TODAY
    );
    assert.equal((await results())['Karim Omran'], '—');
  });

  it('a student of another grade: refused, and NOTHING is saved', async () => {
    const before = await results();
    const outcome = await repo.saveResults(
      teacherA,
      examId,
      [
        { studentId: s.laila!, status: 'scored', score: 35 },
        { studentId: s.grade1!, status: 'scored', score: 35 },
      ],
      TODAY
    );
    assert.deepEqual(outcome, { status: 'student-not-found' });
    assert.deepEqual(await results(), before, 'Laila was not saved either');
  });

  it('another teacher’s student: refused', async () => {
    const outcome = await repo.saveResults(
      teacherA,
      examId,
      [{ studentId: s.other!, status: 'absent' }],
      TODAY
    );
    assert.deepEqual(outcome, { status: 'student-not-found' });
  });

  it('a score above "out of": refused with the limit, nothing saved', async () => {
    const before = await results();
    const outcome = await repo.saveResults(
      teacherA,
      examId,
      [
        { studentId: s.laila!, status: 'scored', score: 30 },
        { studentId: s.omar!, status: 'scored', score: 45 },
      ],
      TODAY
    );
    assert.deepEqual(outcome, { status: 'score-above-max', maxMark: 40 });
    assert.deepEqual(await results(), before);
  });

  it('a future exam: refused', async () => {
    const future = await newExam({ title: 'Future save', heldOn: FUTURE });
    const outcome = await repo.saveResults(
      teacherA,
      future,
      [{ studentId: s.omar!, status: 'scored', score: 30 }],
      TODAY
    );
    assert.deepEqual(outcome, { status: 'date-in-future' });
  });

  it('another teacher’s exam: not found', async () => {
    const outcome = await repo.saveResults(
      teacherB,
      examId,
      [{ studentId: s.omar!, status: 'absent' }],
      TODAY
    );
    assert.deepEqual(outcome, { status: 'not-found' });
  });

  it('10 saves at once for the same students: no errors, one row each', async () => {
    const concurrent = await newExam({ title: 'Concurrent' });
    const outcomes = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        repo.saveResults(
          teacherA,
          concurrent,
          [
            { studentId: s.omar!, status: 'scored', score: 20 + i },
            { studentId: s.salma!, status: 'absent' },
          ],
          TODAY
        )
      )
    );
    assert.ok(outcomes.every((o) => o.status === 'saved'));
    const rows = await one<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM exam_results WHERE exam_id = $1',
      [concurrent]
    );
    assert.equal(rows.n, 2);
  });
});

describe('who is on an exam (roster)', () => {
  it('a student who joined after the exam day is not on it', async () => {
    const id = await newExam({ title: 'Roster exam' });
    const names = (await repo.findExamResults(teacherA, id)).map((r) => r.student_name);
    assert.ok(!names.includes('Zeina Late'));
    assert.equal(names.length, 5);
  });

  it('...unless they have a result: a result is a fact', async () => {
    const id = await newExam({ title: 'Roster with late' });
    await repo.saveResults(
      teacherA,
      id,
      [{ studentId: s.late!, status: 'scored', score: 30 }],
      TODAY
    );
    const names = (await repo.findExamResults(teacherA, id)).map((r) => r.student_name);
    assert.ok(names.includes('Zeina Late'));
  });

  it('a student of another grade is never on it', async () => {
    const id = await newExam({ title: 'Roster grade' });
    const names = (await repo.findExamResults(teacherA, id)).map((r) => r.student_name);
    assert.ok(!names.includes('Nour Grade1'));
  });

  it('rows carry the student’s group', async () => {
    const id = await newExam({ title: 'Roster groups' });
    const karim = (await repo.findExamResults(teacherA, id)).find((r) => r.student_id === s.karim);
    assert.deepEqual(
      { group_id: karim?.group_id, group_name: karim?.group_name },
      { group_id: groupB, group_name: 'Group B' }
    );
  });
});

describe('findExamSummaries: the list’s numbers', () => {
  let examId = '';
  before(async () => {
    examId = await newExam({ title: 'Summary exam', maxMark: 40, passMark: 20 });
    await repo.saveResults(
      teacherA,
      examId,
      [
        { studentId: s.omar!, status: 'scored', score: 40 },
        { studentId: s.hassan!, status: 'scored', score: 14 },
        { studentId: s.karim!, status: 'scored', score: 27 },
        { studentId: s.salma!, status: 'absent' },
      ],
      TODAY
    );
  });

  it('counts total, entered, average (of those who sat it), failed, full marks', async () => {
    const row = (await repo.findExamSummaries(teacherA)).find((e) => e.id === examId);
    assert.ok(row);
    assert.deepEqual(
      {
        total: row.total,
        entered: row.entered,
        average: row.average_score,
        failed: row.failed,
        full: row.full_marks,
      },
      // 5 on the roster (Zeina joined later); Laila not entered.
      // Average of 40, 14, 27 = 27. Failed: 14 < 20. Full: 40.
      { total: 5, entered: 4, average: 27, failed: 1, full: 1 }
    );
  });

  it('a future exam: everyone "not entered", no average', async () => {
    const id = await newExam({ title: 'Empty summary', heldOn: FUTURE });
    const row = (await repo.findExamSummaries(teacherA)).find((e) => e.id === id);
    // 6, not 5: Zeina joined before THIS exam's day, so she's on it.
    assert.deepEqual([row?.total, row?.entered, row?.average_score, row?.failed], [6, 0, null, 0]);
  });

  it('agrees with the exam page’s rows (same roster)', async () => {
    const summary = (await repo.findExamSummaries(teacherA)).find((e) => e.id === examId);
    const rows = await repo.findExamResults(teacherA, examId);
    assert.equal(summary?.total, rows.length);
    assert.equal(summary?.entered, rows.filter((r) => r.status !== null).length);
  });

  it('newest first, and only this teacher’s', async () => {
    const list = await repo.findExamSummaries(teacherA);
    const days = list.map((e) => e.held_on);
    assert.deepEqual(days, [...days].sort().reverse());
    assert.deepEqual(await repo.findExamSummaries(teacherB), []);
  });
});

describe('updateExam', () => {
  it('edits the exam’s fields', async () => {
    const id = await newExam({ title: 'Before edit' });
    const outcome = await repo.updateExam(
      teacherA,
      id,
      exam({ title: 'After edit', kind: 'quiz', maxMark: 50, passMark: 25 }),
      TODAY
    );
    assert.equal(outcome, 'updated');
    const row = await repo.findExam(teacherA, id);
    assert.deepEqual(
      [row?.title, row?.kind, row?.max_mark, row?.pass_mark],
      ['After edit', 'quiz', 50, 25]
    );
  });

  it('another teacher: not found', async () => {
    const id = await newExam({ title: 'Not yours' });
    assert.equal(await repo.updateExam(teacherB, id, exam(), TODAY), 'not-found');
  });

  it('moving an exam WITH results into the future: refused', async () => {
    const id = await newExam({ title: 'Has results' });
    await repo.saveResults(
      teacherA,
      id,
      [{ studentId: s.omar!, status: 'scored', score: 30 }],
      TODAY
    );
    assert.equal(
      await repo.updateExam(teacherA, id, exam({ heldOn: FUTURE }), TODAY),
      'results-on-future-date'
    );
  });

  it('moving an exam WITHOUT results into the future: fine', async () => {
    const id = await newExam({ title: 'No results yet' });
    assert.equal(await repo.updateExam(teacherA, id, exam({ heldOn: FUTURE }), TODAY), 'updated');
  });

  it('lowering "out of" below a saved score throws exam_results_score_check', async () => {
    const id = await newExam({ title: 'Lower max' });
    await repo.saveResults(
      teacherA,
      id,
      [{ studentId: s.omar!, status: 'scored', score: 35 }],
      TODAY
    );
    await assert.rejects(
      repo.updateExam(teacherA, id, exam({ maxMark: 30, passMark: 15 }), TODAY),
      (error) => isCheckViolation(error, 'exam_results_score_check')
    );
    assert.equal((await repo.findExam(teacherA, id))?.max_mark, 40, 'unchanged');
  });
});

describe('findGradeGroups', () => {
  it('lists the grade’s groups in order', async () => {
    assert.deepEqual(await repo.findGradeGroups(grade3), [
      { id: groupA, name: 'Group A' },
      { id: groupB, name: 'Group B' },
    ]);
  });
});
