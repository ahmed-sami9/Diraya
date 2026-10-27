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

/* -------------------------------- Schedules ------------------------------- */

// One weekly slot. weekday: 0 = Sunday ... 6 = Saturday. startTime: "16:00".
export type ScheduleSlot = {
  weekday: number;
  startTime: string;
};

export type GroupScheduleRow = ScheduleSlot & { groupId: string };

// Egypt's week starts on Saturday, so Saturday sorts first: (6 + 1) % 7 = 0.
const WEEK_ORDER = '(weekday + 1) % 7, start_time';

// The timetables of several groups in one query (a grade page shows them all).
// Groups that aren't this teacher's simply return nothing.
export async function findSchedulesByGroups(
  teacherId: string,
  groupIds: string[]
): Promise<GroupScheduleRow[]> {
  const result = await pool.query<GroupScheduleRow>(
    `
      SELECT group_id::text AS "groupId", weekday, to_char(start_time, 'HH24:MI') AS "startTime"
      FROM group_schedules
      WHERE teacher_id = $1 AND group_id = ANY ($2::bigint[])
      ORDER BY group_id, ${WEEK_ORDER}
    `,
    [teacherId, groupIds]
  );

  return result.rows;
}

export type ReplaceScheduleResult =
  | { status: 'saved'; slots: ScheduleSlot[]; group: GroupRow & { gradeId: string } }
  | { status: 'not-found' };

// Replaces a group's whole timetable with `slots` (an empty list clears it).
// Replace-all instead of adding and removing slots one by one: the form
// always sends the full week, and there's no half-edited timetable to handle.
//
// One transaction, and the group's row is locked first (FOR UPDATE): two
// saves from two tabs run one after the other instead of deleting each
// other's rows halfway. If anything fails (a duplicate weekday, a bad time),
// the old timetable is left exactly as it was.
export async function replaceGroupSchedule(
  teacherId: string,
  groupId: string,
  slots: ScheduleSlot[]
): Promise<ReplaceScheduleResult> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const group = await client.query<GroupRow & { gradeId: string }>(
      `
        SELECT id::text AS id, name, grade_id::text AS "gradeId"
        FROM groups
        WHERE teacher_id = $1 AND id = $2
        FOR UPDATE
      `,
      [teacherId, groupId]
    );

    if (!group.rows[0]) {
      await client.query('ROLLBACK');
      return { status: 'not-found' };
    }

    await client.query(`DELETE FROM group_schedules WHERE group_id = $1`, [groupId]);

    const saved = await client.query<ScheduleSlot>(
      `
        INSERT INTO group_schedules (teacher_id, group_id, weekday, start_time)
        SELECT $1, $2, slot.weekday, slot.start_time
        FROM unnest($3::smallint[], $4::time[]) AS slot(weekday, start_time)
        RETURNING weekday, to_char(start_time, 'HH24:MI') AS "startTime"
      `,
      [
        teacherId,
        groupId,
        slots.map((slot) => slot.weekday),
        slots.map((slot) => slot.startTime),
      ]
    );

    await client.query('COMMIT');

    // RETURNING doesn't promise an order; the week does.
    const weekPosition = (slot: ScheduleSlot) => (slot.weekday + 1) % 7;
    return {
      status: 'saved',
      group: group.rows[0],
      slots: saved.rows.sort(
        (a, b) => weekPosition(a) - weekPosition(b) || a.startTime.localeCompare(b.startTime)
      ),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Each grade's next class, from now: the soonest upcoming slot across all its
// groups' schedules. `now` is a parameter so tests can fix the clock.
//
// Worked out in Egypt's local time: this week's day for the slot, plus a week
// if that moment has already passed. A class that started a minute ago counts
// as next week's: it's no longer "next".
export async function findNextSessions(
  teacherId: string,
  gradeIds: string[],
  now: Date
): Promise<{ gradeId: string; groupName: string; startsAt: Date }[]> {
  const result = await pool.query<{ gradeId: string; groupName: string; startsAt: Date }>(
    `
      SELECT DISTINCT ON (g.grade_id)
        g.grade_id::text AS "gradeId",
        g.name AS "groupName",
        next.starts_at AS "startsAt"
      FROM group_schedules gs
      JOIN groups g ON g.id = gs.group_id
      CROSS JOIN LATERAL (
        SELECT $3::timestamptz AT TIME ZONE 'Africa/Cairo' AS now_local
      ) clock
      CROSS JOIN LATERAL (
        SELECT clock.now_local::date
          + ((gs.weekday - EXTRACT(DOW FROM clock.now_local)::int + 7) % 7)
          + gs.start_time AS this_week
      ) slot
      CROSS JOIN LATERAL (
        SELECT (
          CASE WHEN slot.this_week > clock.now_local
            THEN slot.this_week
            ELSE slot.this_week + INTERVAL '7 days'
          END
        ) AT TIME ZONE 'Africa/Cairo' AS starts_at
      ) next
      WHERE gs.teacher_id = $1 AND g.grade_id = ANY ($2::bigint[])
      ORDER BY g.grade_id, next.starts_at, g.name
    `,
    [teacherId, gradeIds, now]
  );

  return result.rows;
}
