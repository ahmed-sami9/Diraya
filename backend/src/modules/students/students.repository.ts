import { pool } from '../../config/db';

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
};

// Only the columns the grade table shows. Phones and notes stay out of this
// list: they belong to the profile, and a list that never sends them can
// never leak them.
export async function findStudentsByGrade(
  teacherId: string,
  gradeId: string
): Promise<GradeStudentRow[]> {
  const result = await pool.query<GradeStudentRow>(
    `
      SELECT
        id::text AS id,
        code,
        full_name AS name,
        group_id::text AS group_id,
        created_at AS joined_at
      FROM students
      WHERE teacher_id = $1 AND grade_id = $2
      ORDER BY full_name, id
    `,
    [teacherId, gradeId]
  );

  return result.rows;
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

    const grade = await client.query(`SELECT 1 FROM grades WHERE id = $1 AND teacher_id = $2`, [
      gradeId,
      teacherId,
    ]);

    if (grade.rowCount === 0) {
      await client.query('ROLLBACK');
      return { status: 'grade-not-found' };
    }

    // The group must be in the SAME grade, not just belong to the teacher:
    // otherwise a hand-made request could put a Grade 1 student in a
    // Grade 3 group. The composite foreign key refuses that too; checking
    // here gives a clear 404 instead of a database error.
    const group = await client.query(
      `SELECT 1 FROM groups WHERE id = $1 AND grade_id = $2 AND teacher_id = $3`,
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
        INSERT INTO students (teacher_id, grade_id, group_id, full_name, parent_phone, phone, notes, code)
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          to_char(NOW() AT TIME ZONE 'Africa/Cairo', 'YY') || '-' || lpad($8::text, 4, '0')
        )
        RETURNING
          id::text AS id,
          code,
          full_name AS name,
          group_id::text AS group_id,
          created_at AS joined_at
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

    await client.query('COMMIT');

    return { status: 'created', student: result.rows[0]! };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    // Always give the connection back to the pool, or the app slowly runs
    // out of connections.
    client.release();
  }
}
