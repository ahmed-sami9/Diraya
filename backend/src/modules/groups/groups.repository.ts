import { pool } from '../../config/db';

// SQL for groups. Every query filters by teacherId, so a teacher can never
// read or change another teacher's group, even with a guessed id.

export type GroupRow = {
  id: string;
  name: string;
};

// The groups of one grade, in the order they were created.
export async function findGroupsByGrade(teacherId: string, gradeId: string): Promise<GroupRow[]> {
  const result = await pool.query<GroupRow>(
    `
      SELECT id::text AS id, name
      FROM groups
      WHERE teacher_id = $1 AND grade_id = $2
      ORDER BY created_at, id
    `,
    [teacherId, gradeId]
  );

  return result.rows;
}

// Inserts only if the grade exists AND belongs to this teacher: the INSERT
// copies its values from a SELECT on that grade, so a grade id that isn't
// the teacher's inserts nothing. Returns null in that case.
//
// Throws a unique violation (groups_grade_id_name_unique) if the name is taken.
export async function insertGroup(
  teacherId: string,
  gradeId: string,
  name: string
): Promise<GroupRow | null> {
  const result = await pool.query<GroupRow>(
    `
      INSERT INTO groups (teacher_id, grade_id, name)
      SELECT g.teacher_id, g.id, $3
      FROM grades g
      WHERE g.id = $2 AND g.teacher_id = $1
      RETURNING id::text AS id, name
    `,
    [teacherId, gradeId, name]
  );

  return result.rows[0] ?? null;
}

// Returns null when no group with this id belongs to the teacher.
// Throws a unique violation if the new name is taken in the same grade.
export async function updateGroupName(
  teacherId: string,
  groupId: string,
  name: string
): Promise<GroupRow | null> {
  const result = await pool.query<GroupRow>(
    `
      UPDATE groups
      SET name = $3
      WHERE teacher_id = $1 AND id = $2
      RETURNING id::text AS id, name
    `,
    [teacherId, groupId, name]
  );

  return result.rows[0] ?? null;
}

export type DeleteGroupResult =
  | { status: 'deleted' }
  | { status: 'not-found' }
  | { status: 'last-group' }
  | { status: 'has-students' }
  | { status: 'target-not-found' };

// Deletes a group, first moving its students to `moveToGroupId` when one is
// given. One transaction: the students are never left without a group.
//
// The grade's row is locked first (FOR UPDATE). Two deletes in the same grade
// then run one after the other, so two tabs deleting the last two groups at
// once can't leave the grade with none: the second one waits, then sees it
// would delete the last group.
export async function deleteGroupMovingStudents(
  teacherId: string,
  groupId: string,
  moveToGroupId: string | null
): Promise<DeleteGroupResult> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const group = await client.query<{ grade_id: string }>(
      `
        SELECT gr.grade_id::text AS grade_id
        FROM groups gr
        JOIN grades g ON g.id = gr.grade_id
        WHERE gr.teacher_id = $1 AND gr.id = $2
        FOR UPDATE OF g
      `,
      [teacherId, groupId]
    );

    const gradeId = group.rows[0]?.grade_id;

    const stop = async (result: DeleteGroupResult) => {
      await client.query('ROLLBACK');
      return result;
    };

    if (!gradeId) return await stop({ status: 'not-found' });

    const others = await client.query(
      `SELECT 1 FROM groups WHERE grade_id = $1 AND id <> $2 LIMIT 1`,
      [gradeId, groupId]
    );

    if (others.rowCount === 0) return await stop({ status: 'last-group' });

    if (moveToGroupId) {
      // The target must be another group of the SAME grade. The composite
      // foreign key would refuse anything else too; checking here gives a
      // clear answer instead of a database error.
      const target = await client.query(
        `SELECT 1 FROM groups WHERE id = $1 AND grade_id = $2 AND teacher_id = $3 AND id <> $4`,
        [moveToGroupId, gradeId, teacherId, groupId]
      );

      if (target.rowCount === 0) return await stop({ status: 'target-not-found' });

      await client.query(`UPDATE students SET group_id = $1 WHERE group_id = $2`, [
        moveToGroupId,
        groupId,
      ]);
    } else {
      const students = await client.query(`SELECT 1 FROM students WHERE group_id = $1 LIMIT 1`, [
        groupId,
      ]);

      if ((students.rowCount ?? 0) > 0) return await stop({ status: 'has-students' });
    }

    await client.query(`DELETE FROM groups WHERE id = $1`, [groupId]);

    await client.query('COMMIT');

    return { status: 'deleted' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
