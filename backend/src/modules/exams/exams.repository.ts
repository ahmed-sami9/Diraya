import { pool } from '../../config/db';

// SQL for exams and their results. Every query is scoped to the teacher,
// either directly (WHERE teacher_id = ...) or through an exam that was
// checked to be theirs in the same statement or transaction.
//
// Conventions for what comes back:
//   - ids as text (bigint can be bigger than a JS number)
//   - days as "YYYY-MM-DD" text (to_char), never a JS Date: a Date would
//     shift the day with the server's time zone
//   - marks as float8: whole and half marks are exact in floating point,
//     and pg would otherwise return numeric as a string

export type ExamKind = 'exam' | 'quiz';
export type ResultStatus = 'scored' | 'absent';

/* ---------------------------- Who is on an exam --------------------------- */

// The students an exam is for, as one SQL fragment. Used by BOTH the list's
// counts and the exam page's rows, so the two pages can't disagree.
//
//   - the grade's students who had joined by the exam day (someone added
//     later never sat it, so they're not "not entered"), Egypt's calendar
//   - plus anyone with a result (a result is a fact, whatever the dates say)
//
// It expects the exam's row to be called `e`. UNION removes duplicates.
const EXAM_ROSTER = `
  SELECT s.id AS student_id
  FROM students s
  WHERE s.grade_id = e.grade_id
    AND (s.created_at AT TIME ZONE 'Africa/Cairo')::date <= e.held_on
  UNION
  SELECT r.student_id
  FROM exam_results r
  WHERE r.exam_id = e.id
`;

// The exam's own columns, shaped the same way everywhere.
const EXAM_COLUMNS = `
  e.id::text AS id,
  e.title,
  e.kind,
  to_char(e.held_on, 'YYYY-MM-DD') AS held_on,
  e.max_mark,
  e.pass_mark::float8 AS pass_mark,
  g.id::text AS grade_id,
  g.name AS grade_name
`;

export type ExamRow = {
  id: string;
  title: string;
  kind: ExamKind;
  held_on: string;
  max_mark: number;
  pass_mark: number;
  grade_id: string;
  grade_name: string;
};

/* ---------------------------------- List ---------------------------------- */

export type ExamSummaryRow = ExamRow & {
  total: number;
  entered: number;
  // Of the students who SAT it (absent rows have no score, so AVG skips
  // them). null until someone has a mark.
  average_score: number | null;
  failed: number;
  full_marks: number;
};

// Every exam of the teacher with its counted results, newest first.
// One query: the LATERAL subquery counts each exam's roster and results.
export async function findExamSummaries(teacherId: string): Promise<ExamSummaryRow[]> {
  const result = await pool.query<ExamSummaryRow>(
    `
      SELECT
        ${EXAM_COLUMNS},
        counts.total,
        counts.entered,
        counts.average_score,
        counts.failed,
        counts.full_marks
      FROM exams e
      JOIN grades g ON g.id = e.grade_id
      CROSS JOIN LATERAL (
        SELECT
          COUNT(*)::int AS total,
          COUNT(r.student_id)::int AS entered,
          AVG(r.score)::float8 AS average_score,
          COUNT(*) FILTER (WHERE r.score < e.pass_mark)::int AS failed,
          COUNT(*) FILTER (WHERE r.score = e.max_mark)::int AS full_marks
        FROM (${EXAM_ROSTER}) roster
        LEFT JOIN exam_results r
          ON r.exam_id = e.id AND r.student_id = roster.student_id
      ) counts
      WHERE e.teacher_id = $1
      ORDER BY e.held_on DESC, e.id DESC
    `,
    [teacherId]
  );

  return result.rows;
}

/* ------------------------------- One exam --------------------------------- */

// The exam, only if it's this teacher's.
export async function findExam(teacherId: string, examId: string): Promise<ExamRow | null> {
  const result = await pool.query<ExamRow>(
    `
      SELECT ${EXAM_COLUMNS}
      FROM exams e
      JOIN grades g ON g.id = e.grade_id
      WHERE e.teacher_id = $1 AND e.id = $2
    `,
    [teacherId, examId]
  );

  return result.rows[0] ?? null;
}

export type GroupRow = { id: string; name: string };

// The grade's groups, in the order they were made (for the page's filter).
export async function findGradeGroups(gradeId: string): Promise<GroupRow[]> {
  const result = await pool.query<GroupRow>(
    `
      SELECT id::text AS id, name
      FROM groups
      WHERE grade_id = $1
      ORDER BY created_at, id
    `,
    [gradeId]
  );

  return result.rows;
}

export type ResultRow = {
  student_id: string;
  student_name: string;
  student_code: string;
  group_id: string;
  group_name: string;
  // null: no row yet, "not entered".
  status: ResultStatus | null;
  score: number | null;
};

// One row per student on the exam, with their result if there is one.
// Empty when the exam isn't this teacher's.
export async function findExamResults(teacherId: string, examId: string): Promise<ResultRow[]> {
  const result = await pool.query<ResultRow>(
    `
      SELECT
        s.id::text AS student_id,
        s.full_name AS student_name,
        s.code AS student_code,
        gr.id::text AS group_id,
        gr.name AS group_name,
        r.status,
        r.score::float8 AS score
      FROM exams e
      CROSS JOIN LATERAL (${EXAM_ROSTER}) roster
      JOIN students s ON s.id = roster.student_id
      JOIN groups gr ON gr.id = s.group_id
      LEFT JOIN exam_results r
        ON r.exam_id = e.id AND r.student_id = s.id
      WHERE e.teacher_id = $1 AND e.id = $2
      ORDER BY s.full_name, s.id
    `,
    [teacherId, examId]
  );

  return result.rows;
}

/* --------------------------------- Create --------------------------------- */

export type ExamInput = {
  title: string;
  kind: ExamKind;
  heldOn: string;
  maxMark: number;
  passMark: number;
};

// Adds an exam to one of the teacher's grades. INSERT ... SELECT checks the
// grade is theirs in the same statement: another teacher's grade (or a
// deleted one) inserts nothing, and the caller gets null.
export async function insertExam(
  teacherId: string,
  gradeId: string,
  input: ExamInput
): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    `
      INSERT INTO exams (teacher_id, grade_id, title, kind, held_on, max_mark, pass_mark)
      SELECT g.teacher_id, g.id, $3, $4, $5::date, $6, $7
      FROM grades g
      WHERE g.teacher_id = $1 AND g.id = $2
      RETURNING id::text AS id
    `,
    [teacherId, gradeId, input.title, input.kind, input.heldOn, input.maxMark, input.passMark]
  );

  return result.rows[0]?.id ?? null;
}

/* ---------------------------------- Edit ---------------------------------- */

export type UpdateExamResult = 'updated' | 'not-found' | 'results-on-future-date';

// Edits an exam's own fields (never its grade).
//
// The WHERE refuses to move an exam that already has results to a day after
// `today`: marks for an exam that hasn't happened can't exist.
//
// Lowering max_mark below a saved score makes the database refuse the whole
// UPDATE (exam_results_score_check, through the ON UPDATE CASCADE). That
// error is left to the service, which knows how to explain it.
export async function updateExam(
  teacherId: string,
  examId: string,
  input: ExamInput,
  today: string
): Promise<UpdateExamResult> {
  const result = await pool.query(
    `
      UPDATE exams e
      SET title = $3,
          kind = $4,
          held_on = $5::date,
          max_mark = $6,
          pass_mark = $7,
          updated_at = CURRENT_TIMESTAMP
      WHERE e.teacher_id = $1 AND e.id = $2
        AND NOT (
          $5::date > $8::date
          AND EXISTS (SELECT 1 FROM exam_results r WHERE r.exam_id = e.id)
        )
    `,
    [teacherId, examId, input.title, input.kind, input.heldOn, input.maxMark, input.passMark, today]
  );

  if ((result.rowCount ?? 0) > 0) return 'updated';

  // Nothing changed: either it isn't theirs, or the date rule refused it.
  const exists = await findExam(teacherId, examId);
  return exists ? 'results-on-future-date' : 'not-found';
}

/* --------------------------------- Delete --------------------------------- */

// Its results go with it (ON DELETE CASCADE). false: not this teacher's.
export async function deleteExam(teacherId: string, examId: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM exams WHERE teacher_id = $1 AND id = $2', [
    teacherId,
    examId,
  ]);

  return (result.rowCount ?? 0) > 0;
}

/* ------------------------------ Save results ------------------------------ */

export type ResultToSave =
  | { studentId: string; status: 'scored'; score: number }
  | { studentId: string; status: 'absent' }
  | { studentId: string; status: 'not-entered' };

export type SaveResultsOutcome =
  | { status: 'saved' }
  | { status: 'not-found' }
  | { status: 'date-in-future' }
  | { status: 'student-not-found' }
  | { status: 'score-above-max'; maxMark: number };

// Saves the results of the students listed (the others are untouched), as
// ONE transaction: every change is saved, or none.
//
// 1. Lock the exam row (FOR SHARE) and read it. While this transaction runs,
//    nobody can change its date or "out of", so the checks below stay true
//    until COMMIT. (Other saves can share the lock and run side by side.)
// 2. Check the rules with clear answers: the exam has happened, every
//    student is this teacher's and in this exam's grade, no score is above
//    "out of". (The database checks the last two again, as a backstop.)
// 3. Upsert 'scored' and 'absent' in one statement (unnest = arrays as rows).
// 4. Delete the rows of 'not-entered': the teacher cleared those boxes.
export async function saveResults(
  teacherId: string,
  examId: string,
  results: ResultToSave[],
  today: string
): Promise<SaveResultsOutcome> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const exam = await client.query<{ grade_id: string; max_mark: number; held_on: string }>(
      `
        SELECT grade_id::text AS grade_id, max_mark, to_char(held_on, 'YYYY-MM-DD') AS held_on
        FROM exams
        WHERE teacher_id = $1 AND id = $2
        FOR SHARE
      `,
      [teacherId, examId]
    );

    const row = exam.rows[0];

    if (!row) {
      await client.query('ROLLBACK');
      return { status: 'not-found' };
    }

    if (row.held_on > today) {
      await client.query('ROLLBACK');
      return { status: 'date-in-future' };
    }

    if (results.some((item) => item.status === 'scored' && item.score > row.max_mark)) {
      await client.query('ROLLBACK');
      return { status: 'score-above-max', maxMark: row.max_mark };
    }

    // Every listed student must be this teacher's and in the exam's grade.
    // (The ids are unique: the validation refuses duplicates.)
    const studentIds = results.map((item) => item.studentId);

    const found = await client.query<{ count: number }>(
      `
        SELECT COUNT(*)::int AS count
        FROM students
        WHERE id = ANY ($1::bigint[]) AND teacher_id = $2 AND grade_id = $3
      `,
      [studentIds, teacherId, row.grade_id]
    );

    if (found.rows[0]?.count !== studentIds.length) {
      await client.query('ROLLBACK');
      return { status: 'student-not-found' };
    }

    const toWrite = results.filter((item) => item.status !== 'not-entered');

    if (toWrite.length > 0) {
      await client.query(
        `
          INSERT INTO exam_results (exam_id, student_id, grade_id, max_mark, status, score)
          SELECT $1, x.student_id, $2, $3, x.status, x.score
          FROM unnest($4::bigint[], $5::text[], $6::numeric[]) AS x (student_id, status, score)
          ON CONFLICT (exam_id, student_id) DO UPDATE
          SET status = EXCLUDED.status,
              score = EXCLUDED.score,
              entered_at = CURRENT_TIMESTAMP
        `,
        [
          examId,
          row.grade_id,
          row.max_mark,
          toWrite.map((item) => item.studentId),
          toWrite.map((item) => item.status),
          toWrite.map((item) => (item.status === 'scored' ? item.score : null)),
        ]
      );
    }

    const toClear = results
      .filter((item) => item.status === 'not-entered')
      .map((item) => item.studentId);

    if (toClear.length > 0) {
      await client.query(
        'DELETE FROM exam_results WHERE exam_id = $1 AND student_id = ANY ($2::bigint[])',
        [examId, toClear]
      );
    }

    await client.query('COMMIT');

    return { status: 'saved' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
