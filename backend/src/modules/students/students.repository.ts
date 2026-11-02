import { pool } from '../../config/db';
import { logActivity } from '../activity/activity.repository';
import { markAveragesSql } from '../exams/exams.repository';
import { studentMonthsSql, type MonthStatus } from '../payments/payments.repository';

export type StudentSearchRow = {
  id: string;
  name: string;
  grade_name: string;
  group_name: string;
};

// In LIKE patterns, % and _ are wildcards and \ escapes them. A teacher
// typing "50%" means the characters 5, 0, %, not "50 followed by anything",
// so those characters are escaped before going into the pattern.
function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, '\\$&');
}

// Students of this teacher whose name contains the text, ignoring case.
//
// Names that START with the text come first ("Om" -> Omar before Karim
// Omran), then alphabetical.
export async function searchStudentsByName(
  teacherId: string,
  text: string,
  limit: number
): Promise<StudentSearchRow[]> {
  const escaped = escapeLikePattern(text);

  const result = await pool.query<StudentSearchRow>(
    `
      SELECT
        s.id::text AS id,
        s.full_name AS name,
        g.name AS grade_name,
        gr.name AS group_name
      FROM students s
      JOIN grades g ON g.id = s.grade_id
      JOIN groups gr ON gr.id = s.group_id
      WHERE s.teacher_id = $1
        AND s.full_name ILIKE '%' || $2 || '%' ESCAPE '\\'
      ORDER BY
        (s.full_name ILIKE $2 || '%' ESCAPE '\\') DESC,
        s.full_name,
        s.id
      LIMIT $3
    `,
    [teacherId, escaped, limit]
  );

  return result.rows;
}

/* ------------------------- A grade's students ------------------------- */

export type GradeStudentRow = {
  id: string;
  code: string;
  name: string;
  group_id: string;
  joined_at: Date;
  // The numbers behind the attendance rate (see attendance.rules.ts).
  attended: number;
  attendance_total: number;
  // Unrounded %; null until they have a mark.
  average_mark: number | null;
  // This month's fee status, by the payments page's own rules.
  payment_status: MonthStatus | null;
  // The teacher's order within the group; null: not placed yet.
  position: number | null;
};

// Only the columns the grade table shows. Phones and notes stay out of this
// list: they belong to the profile, and a list that never sends them can
// never leak them.
//
// Marks and fees reuse the exams and payments SQL, so a row here always
// matches the student's profile and the payments page. `onlyStudentId`
// reads one row (a student just added) with the same rules.
export async function findStudentsByGrade(
  teacherId: string,
  gradeId: string,
  currentMonth: string,
  onlyStudentId: string | null = null
): Promise<GradeStudentRow[]> {
  const result = await pool.query<GradeStudentRow>(
    `
      SELECT
        s.id::text AS id,
        s.code,
        s.full_name AS name,
        s.group_id::text AS group_id,
        s.created_at AS joined_at,
        s.position,
        COALESCE(a.attended, 0) AS attended,
        COALESCE(a.total, 0) AS attendance_total,
        m.average AS average_mark,
        f.status AS payment_status
      FROM students s
      -- Each student's counts in one pass over the grade's records, then
      -- joined by student. LEFT: students with no records keep 0 / 0.
      LEFT JOIN (
        SELECT
          r.student_id,
          COUNT(*) FILTER (WHERE r.status IN ('present', 'late'))::int AS attended,
          COUNT(*) FILTER (WHERE r.status <> 'excused')::int AS total
        FROM attendance_records r
        WHERE r.grade_id = $2
        GROUP BY r.student_id
      ) a ON a.student_id = s.id
      LEFT JOIN (
        ${markAveragesSql({
          where:
            'r.student_id IN (SELECT id FROM students WHERE teacher_id = $1 AND grade_id = $2)',
          currentMonth: '$3::date',
        })}
      ) m ON m.student_id = s.id
      LEFT JOIN (
        ${studentMonthsSql({
          where: 's.teacher_id = $1 AND s.grade_id = $2',
          months: 'SELECT $3::date',
          currentMonth: '$3::date',
        })}
      ) f ON f.student_id = s.id
      WHERE s.teacher_id = $1 AND s.grade_id = $2
        AND ($4::bigint IS NULL OR s.id = $4)
      ORDER BY s.full_name, s.id
    `,
    [teacherId, gradeId, `${currentMonth}-01`, onlyStudentId]
  );

  return result.rows;
}

export type UpdateStudentResult = 'updated' | 'student-not-found' | 'group-not-found';

// One UPDATE that also checks the group: it must be this teacher's and in the
// student's own grade (changing grade is a different job). If nothing was
// updated, a second look says which of the two was missing.
export async function updateStudentDetails(
  teacherId: string,
  studentId: string,
  input: { fullName: string; parentPhone: string; phone: string | null; groupId: string }
): Promise<UpdateStudentResult> {
  const result = await pool.query(
    `
      UPDATE students s
      SET full_name = $3, parent_phone = $4, phone = $5, group_id = $6,
        -- A new group: their place in the old one means nothing there.
        position = CASE WHEN s.group_id = $6 THEN s.position END
      WHERE s.teacher_id = $1 AND s.id = $2
        AND EXISTS (
          SELECT 1 FROM groups g
          WHERE g.id = $6 AND g.teacher_id = $1 AND g.grade_id = s.grade_id
        )
    `,
    [teacherId, studentId, input.fullName, input.parentPhone, input.phone, input.groupId]
  );

  if ((result.rowCount ?? 0) > 0) return 'updated';

  const student = await pool.query('SELECT 1 FROM students WHERE teacher_id = $1 AND id = $2', [
    teacherId,
    studentId,
  ]);

  return (student.rowCount ?? 0) > 0 ? 'group-not-found' : 'student-not-found';
}

export type DeleteStudentResult =
  | { status: 'deleted'; gradeId: string }
  | { status: 'not-found' }
  | { status: 'has-payments'; paidTotal: number };

// Deletes a student and, through ON DELETE CASCADE, everything of theirs:
// attendance, marks, notes, payments. One transaction with its activity entry.
//
// The row is locked first, so a payment recorded at the same moment either
// lands before the check (and is counted) or waits and finds no student.
export async function deleteStudent(
  teacherId: string,
  studentId: string,
  { withPayments }: { withPayments: boolean }
): Promise<DeleteStudentResult> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const found = await client.query<{ name: string; grade_id: string; grade_name: string }>(
      `
        SELECT s.full_name AS name, g.id::text AS grade_id, g.name AS grade_name
        FROM students s
        JOIN grades g ON g.id = s.grade_id
        WHERE s.teacher_id = $1 AND s.id = $2
        FOR UPDATE OF s
      `,
      [teacherId, studentId]
    );
    const student = found.rows[0];

    if (!student) {
      await client.query('ROLLBACK');
      return { status: 'not-found' };
    }

    // Voided payments don't count: they were mistakes, already cancelled.
    const paid = await client.query<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0)::int AS total FROM payments WHERE student_id = $1 AND voided_at IS NULL`,
      [studentId]
    );
    const paidTotal = paid.rows[0]!.total;

    if (paidTotal > 0 && !withPayments) {
      await client.query('ROLLBACK');
      return { status: 'has-payments', paidTotal };
    }

    await client.query('DELETE FROM students WHERE id = $1', [studentId]);

    await logActivity(client, teacherId, 'student.deleted', {
      studentName: student.name,
      gradeName: student.grade_name,
      paidTotal,
    });

    await client.query('COMMIT');

    return { status: 'deleted', gradeId: student.grade_id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export type NewStudent = {
  fullName: string;
  parentPhone: string;
  phone: string | null;
  groupId: string;
  notes: string | null;
};

// What can happen when adding a student. The repository reports it; the
// service decides which error each case becomes.
export type InsertStudentResult =
  | { status: 'created'; student: GradeStudentRow }
  | { status: 'grade-not-found' }
  | { status: 'group-not-found' };

// Adds a student and gives them their code, as ONE transaction: either the
// student exists with a new number, or nothing changed at all (no number
// "used up" by a failed insert).
//
// The number comes from teachers.next_student_number. UPDATE ... RETURNING
// takes it and moves the counter on in one step, and it locks that
// teacher's row until COMMIT. A second "Add student" from the same teacher
// at the same moment waits at that line, then gets the next number: two
// students can never share a code.
export async function insertStudentWithCode(
  teacherId: string,
  gradeId: string,
  input: NewStudent
): Promise<InsertStudentResult> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const grade = await client.query<{ name: string }>(
      `SELECT name FROM grades WHERE id = $1 AND teacher_id = $2`,
      [gradeId, teacherId]
    );

    if (grade.rowCount === 0) {
      await client.query('ROLLBACK');
      return { status: 'grade-not-found' };
    }

    // The group must be in the SAME grade, not just belong to the teacher:
    // otherwise a hand-made request could put a Grade 1 student in a
    // Grade 3 group. The composite foreign key refuses that too; checking
    // here gives a clear 404 instead of a database error.
    const group = await client.query<{ name: string }>(
      `SELECT name FROM groups WHERE id = $1 AND grade_id = $2 AND teacher_id = $3`,
      [input.groupId, gradeId, teacherId]
    );

    if (group.rowCount === 0) {
      await client.query('ROLLBACK');
      return { status: 'group-not-found' };
    }

    const counter = await client.query<{ number: number }>(
      `
        UPDATE teachers
        SET next_student_number = next_student_number + 1
        WHERE id = $1
        RETURNING next_student_number - 1 AS number
      `,
      [teacherId]
    );

    // The code's year is the year in Egypt, not on the server's clock
    // (a server abroad could still be in "last year" on 1 January).
    const result = await client.query<GradeStudentRow>(
      `
        INSERT INTO students (teacher_id, grade_id, group_id, full_name, parent_phone, phone, notes, code, position)
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          to_char(NOW() AT TIME ZONE 'Africa/Cairo', 'YY') || '-' || lpad($8::text, 4, '0'),
          -- The end of a group the teacher has ordered; unplaced (NULL) if they haven't.
          (SELECT MAX(position) + 1 FROM students WHERE group_id = $3)
        )
        RETURNING
          id::text AS id,
          code,
          full_name AS name,
          group_id::text AS group_id,
          created_at AS joined_at,
          position,
          0 AS attended,
          0 AS attendance_total,
          NULL::float8 AS average_mark,
          NULL AS payment_status
      `,
      [
        teacherId,
        gradeId,
        input.groupId,
        input.fullName,
        input.parentPhone,
        input.phone,
        input.notes,
        counter.rows[0]!.number,
      ]
    );

    const student = result.rows[0]!;

    // Recent activity, saved with the student: both, or neither.
    await logActivity(client, teacherId, 'student.added', {
      studentId: student.id,
      studentName: student.name,
      gradeName: grade.rows[0]!.name,
      groupName: group.rows[0]!.name,
    });

    await client.query('COMMIT');

    return { status: 'created', student };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    // Always give the connection back to the pool, or the app slowly runs
    // out of connections.
    client.release();
  }
}

// The Home page's student numbers, counted by the database: one row comes
// back, not every student. `month` is "YYYY-MM"; a student joined in it if
// they were added during that month on Egypt's calendar.
export async function countStudents(
  teacherId: string,
  month: string
): Promise<{ total: number; joined_in_month: number }> {
  const result = await pool.query<{ total: number; joined_in_month: number }>(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE date_trunc('month', created_at AT TIME ZONE 'Africa/Cairo')::date = $2::date
        )::int AS joined_in_month
      FROM students
      WHERE teacher_id = $1
    `,
    [teacherId, `${month}-01`]
  );

  return result.rows[0]!;
}
