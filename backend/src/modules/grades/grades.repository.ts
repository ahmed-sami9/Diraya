import { pool } from '../../config/db';

// SQL for grades. Every query takes teacherId and filters by it, so a teacher
// can never read or change another teacher's grade, even with a guessed id.

export type GradeRow = {
  id: string;
  name: string;
  monthly_fee: number;
  student_count: number;
  group_count: number;
  // The grade's most recent class, across all its groups. All null when no
  // attendance has been taken yet.
  last_held_at: Date | null;
  last_group_name: string | null;
  last_present_count: number | null;
  last_total_count: number | null;
};

// Shared by the list and the single-grade lookup, so both always return the
// same shape. The counts are subqueries: one row per grade, no GROUP BY.
//
// The last session: LEFT JOIN LATERAL runs the small query on the right once
// per grade ("this grade's newest session"), and LEFT keeps grades that have
// none. present = present + late, the same rule as the attendance rate.
// held_at: the class's day and time in Egypt, as one exact moment (noon when
// the start time isn't known, so the day can't slip in any time zone).
const GRADE_SUMMARY_SELECT = `
  SELECT
    g.id::text AS id,
    g.name,
    g.monthly_fee,
    (SELECT COUNT(*)::int FROM students s WHERE s.grade_id = g.id) AS student_count,
    (SELECT COUNT(*)::int FROM groups gr WHERE gr.grade_id = g.id) AS group_count,
    last.held_at AS last_held_at,
    last.group_name AS last_group_name,
    last.present_count AS last_present_count,
    last.total_count AS last_total_count
  FROM grades g
  LEFT JOIN LATERAL (
    SELECT
      (cs.held_on + COALESCE(cs.start_time, TIME '12:00')) AT TIME ZONE 'Africa/Cairo' AS held_at,
      gr.name AS group_name,
      (SELECT COUNT(*)::int FROM attendance_records r
        WHERE r.session_id = cs.id AND r.status IN ('present', 'late')) AS present_count,
      (SELECT COUNT(*)::int FROM attendance_records r WHERE r.session_id = cs.id) AS total_count
    FROM class_sessions cs
    JOIN groups gr ON gr.id = cs.group_id
    WHERE cs.grade_id = g.id
    ORDER BY cs.held_on DESC, cs.id DESC
    LIMIT 1
  ) last ON true
`;

// Oldest first, so grades stay in the order the teacher created them
// (alphabetical would put "Grade 10" before "Grade 2").
export async function findGradesByTeacher(teacherId: string): Promise<GradeRow[]> {
  const result = await pool.query<GradeRow>(
    `
      ${GRADE_SUMMARY_SELECT}
      WHERE g.teacher_id = $1
      ORDER BY g.created_at, g.id
    `,
    [teacherId]
  );

  return result.rows;
}

export async function findGradeById(teacherId: string, gradeId: string): Promise<GradeRow | null> {
  const result = await pool.query<GradeRow>(
    `
      ${GRADE_SUMMARY_SELECT}
      WHERE g.teacher_id = $1 AND g.id = $2
    `,
    [teacherId, gradeId]
  );

  return result.rows[0] ?? null;
}

// Creates the grade AND its first group, in one transaction: a grade always
// has at least one group, because every student must be in one. Either both
// rows exist afterwards, or neither does.
//
// Throws a unique violation (grades_teacher_id_name_unique) if the name is taken.
export async function insertGradeWithFirstGroup(
  teacherId: string,
  input: { name: string; monthlyFee: number },
  firstGroupName: string
): Promise<GradeRow> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query<GradeRow>(
      `
        INSERT INTO grades (teacher_id, name, monthly_fee)
        VALUES ($1, $2, $3)
        RETURNING
          id::text AS id,
          name,
          monthly_fee,
          0 AS student_count,
          1 AS group_count,
          NULL::timestamptz AS last_held_at,
          NULL::text AS last_group_name,
          NULL::int AS last_present_count,
          NULL::int AS last_total_count
      `,
      [teacherId, input.name, input.monthlyFee]
    );

    // INSERT ... RETURNING always returns the row it inserted.
    const grade = result.rows[0]!;

    await client.query(
      `
        INSERT INTO groups (teacher_id, grade_id, name)
        VALUES ($1, $2, $3)
      `,
      [teacherId, grade.id, firstGroupName]
    );

    await client.query('COMMIT');

    return grade;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Returns false when no grade with this id belongs to the teacher.
// Throws a unique violation if the new name is taken.
export async function updateGrade(
  teacherId: string,
  gradeId: string,
  input: { name: string; monthlyFee: number }
): Promise<boolean> {
  const result = await pool.query(
    `
      UPDATE grades
      SET name = $3,
          monthly_fee = $4,
          updated_at = CURRENT_TIMESTAMP
      WHERE teacher_id = $1 AND id = $2
    `,
    [teacherId, gradeId, input.name, input.monthlyFee]
  );

  return (result.rowCount ?? 0) > 0;
}

// Deletes the grade only if it has no students. Its groups go with it
// (ON DELETE CASCADE), which is safe: a group with students can't exist in
// a grade with no students.
//
// The "no students" check is part of the DELETE itself, so there is no gap
// between checking and deleting. Returns true when a grade was deleted.
export async function deleteGradeWithoutStudents(
  teacherId: string,
  gradeId: string
): Promise<boolean> {
  const result = await pool.query(
    `
      DELETE FROM grades g
      WHERE g.teacher_id = $1
        AND g.id = $2
        AND NOT EXISTS (SELECT 1 FROM students s WHERE s.grade_id = g.id)
    `,
    [teacherId, gradeId]
  );

  return (result.rowCount ?? 0) > 0;
}

export async function gradeExists(teacherId: string, gradeId: string): Promise<boolean> {
  const result = await pool.query(
    `
      SELECT 1
      FROM grades
      WHERE teacher_id = $1 AND id = $2
    `,
    [teacherId, gradeId]
  );

  return (result.rowCount ?? 0) > 0;
}
