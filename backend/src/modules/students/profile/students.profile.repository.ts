import { pool } from '../../../config/db';
import { EXAM_ROSTER, markAveragesSql } from '../../exams/exams.repository';
import { studentMonthsSql, type MonthStatus } from '../../payments/payments.repository';

// SQL for one student's profile. Every entry point is protected by
// teacher_id: either the query filters by it directly, or the service calls
// studentExists(teacherId, studentId) first and the query then reads by the
// (already verified) student id.

/* --------------------------------- Student -------------------------------- */

export type StudentProfileRow = {
  id: string;
  code: string;
  name: string;
  parent_phone: string | null;
  phone: string | null;
  joined_at: Date;
  grade_id: string;
  grade_name: string;
  monthly_fee: number | null;
  group_id: string;
  group_name: string;
};

// The header: the student with their grade and group. JOINs, not LEFT
// JOINs: every student has a grade and a group (both NOT NULL).
export async function findStudentProfile(
  teacherId: string,
  studentId: string
): Promise<StudentProfileRow | null> {
  const result = await pool.query<StudentProfileRow>(
    `
      SELECT
        s.id::text AS id,
        s.code,
        s.full_name AS name,
        s.parent_phone,
        s.phone,
        s.created_at AS joined_at,
        g.id::text AS grade_id,
        g.name AS grade_name,
        g.monthly_fee,
        gr.id::text AS group_id,
        gr.name AS group_name
      FROM students s
      JOIN grades g ON g.id = s.grade_id
      JOIN groups gr ON gr.id = s.group_id
      WHERE s.teacher_id = $1 AND s.id = $2
    `,
    [teacherId, studentId]
  );

  return result.rows[0] ?? null;
}

export async function studentExists(teacherId: string, studentId: string): Promise<boolean> {
  const result = await pool.query(`SELECT 1 FROM students WHERE teacher_id = $1 AND id = $2`, [
    teacherId,
    studentId,
  ]);

  return (result.rowCount ?? 0) > 0;
}

/* ------------------------------- Attendance ------------------------------- */

export type AttendanceRow = {
  session_id: string;
  held_at: Date;
  status: 'present' | 'late' | 'absent' | 'excused';
  group_name: string;
  is_make_up: boolean;
  reason: string | null;
};

// A student's marks, newest session first. `limit` null = all of them.
//
// held_at: the session's day and start time are Egypt's local time, stored
// as a date and a time. Adding them and reading the result AT TIME ZONE
// 'Africa/Cairo' turns that into one exact moment (timestamptz), which the
// API sends as an ISO string. Sessions without a start time use noon, so the
// day can never slip to the day before or after in any time zone.
export async function findAttendanceRecords(
  studentId: string,
  limit: number | null
): Promise<AttendanceRow[]> {
  const result = await pool.query<AttendanceRow>(
    `
      SELECT
        cs.id::text AS session_id,
        (cs.held_on + COALESCE(cs.start_time, TIME '12:00')) AT TIME ZONE 'Africa/Cairo' AS held_at,
        r.status,
        gr.name AS group_name,
        r.is_make_up,
        r.reason
      FROM attendance_records r
      JOIN class_sessions cs ON cs.id = r.session_id
      JOIN groups gr ON gr.id = cs.group_id
      WHERE r.student_id = $1
      ORDER BY cs.held_on DESC, cs.id DESC
      LIMIT $2
    `,
    // LIMIT NULL means "no limit" in PostgreSQL.
    [studentId, limit]
  );

  return result.rows;
}

export type AttendanceCounts = {
  attended: number;
  total: number;
};

// The numbers behind the attendance rate, counted by the database.
//
//   attended = present + late (a late student still came)
//   total    = every session except excused ones: an excused absence (a sick
//              note) neither helps nor hurts the rate.
export async function countAttendance(studentId: string): Promise<AttendanceCounts> {
  const result = await pool.query<AttendanceCounts>(
    `
      SELECT
        COUNT(*) FILTER (WHERE status IN ('present', 'late'))::int AS attended,
        COUNT(*) FILTER (WHERE status <> 'excused')::int AS total
      FROM attendance_records
      WHERE student_id = $1
    `,
    [studentId]
  );

  // An aggregate without GROUP BY always returns exactly one row.
  return result.rows[0]!;
}

/* ---------------------------------- Exams --------------------------------- */

export type StudentExamRow = {
  exam_id: string;
  title: string;
  kind: 'quiz' | 'exam';
  held_at: Date;
  max_mark: number;
  // null: no row yet, "not entered".
  status: 'scored' | 'absent' | null;
  score: number | null;
};

// Every exam this student is on (the exams page's own roster), newest first.
// An exam still to come is left out until it has a result: nothing to show yet.
// held_at: the exam day at noon in Egypt, like attendance.
export async function findStudentExams(
  studentId: string,
  today: string
): Promise<StudentExamRow[]> {
  const result = await pool.query<StudentExamRow>(
    `
      SELECT
        e.id::text AS exam_id,
        e.title,
        e.kind,
        (e.held_on + TIME '12:00') AT TIME ZONE 'Africa/Cairo' AS held_at,
        e.max_mark,
        r.status,
        r.score::float8 AS score
      FROM students s
      JOIN exams e ON e.teacher_id = s.teacher_id
      LEFT JOIN exam_results r ON r.exam_id = e.id AND r.student_id = s.id
      WHERE s.id = $1
        AND EXISTS (SELECT 1 FROM (${EXAM_ROSTER}) roster WHERE roster.student_id = s.id)
        AND (r.exam_id IS NOT NULL OR e.held_on <= $2::date)
      ORDER BY e.held_on DESC, e.id DESC
    `,
    [studentId, today]
  );

  return result.rows;
}

export type MarkAverageRow = {
  exam_count: number;
  average: number | null;
  this_month: number | null;
  last_month: number | null;
};

// The marks tile. Always one row: no marks yet is a count of 0.
export async function findStudentMarkAverage(
  studentId: string,
  currentMonth: string
): Promise<MarkAverageRow> {
  const result = await pool.query<MarkAverageRow>(
    `
      SELECT
        COALESCE(m.exam_count, 0) AS exam_count,
        m.average,
        m.this_month,
        m.last_month
      FROM (SELECT 1) one
      LEFT JOIN (${markAveragesSql({ where: 'r.student_id = $1', currentMonth: '$2::date' })}) m ON TRUE
    `,
    [studentId, `${currentMonth}-01`]
  );

  return result.rows[0]!;
}

/* -------------------------------- Payments -------------------------------- */

export type StudentMonthRow = {
  month: string;
  due: number;
  paid: number;
  status: MonthStatus;
  skip_reason: string | null;
  last_paid_at: Date | null;
};

// Every month from joining to now, newest first, with the payments page's own
// rules (studentMonthsSql). Months paid ahead are added on top.
// last_paid_at: the latest payment for that month that wasn't voided, at noon in Egypt.
export async function findStudentPaymentMonths(
  studentId: string,
  currentMonth: string
): Promise<StudentMonthRow[]> {
  const result = await pool.query<StudentMonthRow>(
    `
      SELECT
        to_char(sm.month, 'YYYY-MM') AS month,
        sm.due,
        sm.paid,
        sm.status,
        sm.skip_reason,
        (last.paid_on + TIME '12:00') AT TIME ZONE 'Africa/Cairo' AS last_paid_at
      FROM (
        ${studentMonthsSql({
          where: 's.id = $1',
          // GREATEST skips the NULL when nothing is paid ahead.
          months: `
            SELECT generate_series(
              j.joined_month,
              GREATEST(
                $2::date,
                (SELECT MAX(pm.month)
                 FROM payment_months pm
                 JOIN payments pay ON pay.id = pm.payment_id
                 WHERE pay.student_id = s.id AND pay.voided_at IS NULL)
              ),
              interval '1 month'
            )::date
          `,
          currentMonth: '$2::date',
        })}
      ) sm
      LEFT JOIN LATERAL (
        SELECT MAX(pay.paid_on) AS paid_on
        FROM payment_months pm
        JOIN payments pay ON pay.id = pm.payment_id
        WHERE pay.student_id = sm.student_id AND pm.month = sm.month AND pay.voided_at IS NULL
      ) last ON TRUE
      ORDER BY sm.month DESC
    `,
    [studentId, `${currentMonth}-01`]
  );

  return result.rows;
}

/* ---------------------------------- Notes --------------------------------- */

export type NoteRow = {
  id: string;
  text: string;
  created_at: Date;
};

export async function findNotes(studentId: string): Promise<NoteRow[]> {
  const result = await pool.query<NoteRow>(
    `
      SELECT id::text AS id, text, created_at
      FROM student_notes
      WHERE student_id = $1
      ORDER BY created_at DESC, id DESC
    `,
    [studentId]
  );

  return result.rows;
}

// Inserts only if the student exists AND belongs to this teacher: the INSERT
// copies its values from a SELECT on that student (the same pattern as
// insertGroup). Returns null when there is no such student.
export async function insertNote(
  teacherId: string,
  studentId: string,
  text: string
): Promise<NoteRow | null> {
  const result = await pool.query<NoteRow>(
    `
      INSERT INTO student_notes (teacher_id, student_id, text)
      SELECT s.teacher_id, s.id, $3
      FROM students s
      WHERE s.id = $2 AND s.teacher_id = $1
      RETURNING id::text AS id, text, created_at
    `,
    [teacherId, studentId, text]
  );

  return result.rows[0] ?? null;
}
