import { pool } from '../../../config/db';

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
