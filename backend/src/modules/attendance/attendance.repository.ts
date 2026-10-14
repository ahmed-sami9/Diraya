import { pool } from '../../config/db';

import type { AttendanceStatus } from './attendance.rules';

// SQL for taking attendance. Every query is scoped to the teacher, either
// directly (WHERE teacher_id = $1) or through a group/session that was
// already checked to be theirs.

/* --------------------------------- Pickers -------------------------------- */

export type GradeGroupRow = {
  grade_id: string;
  grade_name: string;
  group_id: string;
  group_name: string;
};

// Every grade with its groups, in the order they were created: one row per
// group. The service folds the rows into grades -> groups.
export async function findGradeGroupOptions(teacherId: string): Promise<GradeGroupRow[]> {
  const result = await pool.query<GradeGroupRow>(
    `
      SELECT
        g.id::text AS grade_id,
        g.name AS grade_name,
        gr.id::text AS group_id,
        gr.name AS group_name
      FROM grades g
      JOIN groups gr ON gr.grade_id = g.id
      WHERE g.teacher_id = $1
      ORDER BY g.created_at, g.id, gr.created_at, gr.id
    `,
    [teacherId]
  );

  return result.rows;
}

/* ----------------------------- Default group ----------------------------- */

// The group whose attendance was taken most recently: the class the teacher
// is most likely to take next. (Once groups have weekly schedules, "the
// class happening now" will come first.)
export async function findMostRecentGroupId(teacherId: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    `
      SELECT group_id::text AS id
      FROM class_sessions
      WHERE teacher_id = $1
      ORDER BY held_on DESC, created_at DESC
      LIMIT 1
    `,
    [teacherId]
  );

  return result.rows[0]?.id ?? null;
}

// A teacher who never took attendance: their first grade's first group.
export async function findFirstGroupId(teacherId: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    `
      SELECT gr.id::text AS id
      FROM groups gr
      JOIN grades g ON g.id = gr.grade_id
      WHERE gr.teacher_id = $1
      ORDER BY g.created_at, g.id, gr.created_at, gr.id
      LIMIT 1
    `,
    [teacherId]
  );

  return result.rows[0]?.id ?? null;
}

/* ---------------------------------- Sheet --------------------------------- */

export type SheetGroupRow = {
  group_id: string;
  group_name: string;
  grade_id: string;
  grade_name: string;
};

// The group (with its grade), only if it's this teacher's.
export async function findGroupWithGrade(
  teacherId: string,
  groupId: string
): Promise<SheetGroupRow | null> {
  const result = await pool.query<SheetGroupRow>(
    `
      SELECT
        gr.id::text AS group_id,
        gr.name AS group_name,
        g.id::text AS grade_id,
        g.name AS grade_name
      FROM groups gr
      JOIN grades g ON g.id = gr.grade_id
      WHERE gr.teacher_id = $1 AND gr.id = $2
    `,
    [teacherId, groupId]
  );

  return result.rows[0] ?? null;
}

export type SessionRow = {
  id: string;
  created_at: Date;
  edited_at: Date | null;
};

// That group's session on that day, if attendance was already taken.
export async function findSession(groupId: string, day: string): Promise<SessionRow | null> {
  const result = await pool.query<SessionRow>(
    `
      SELECT id::text AS id, created_at, edited_at
      FROM class_sessions
      WHERE group_id = $1 AND held_on = $2::date
    `,
    [groupId, day]
  );

  return result.rows[0] ?? null;
}

export type SheetStudentRow = {
  id: string;
  code: string;
  name: string;
  group_name: string;
  status: AttendanceStatus | null;
  reason: string | null;
  is_make_up: boolean;
};

// Who is on the sheet:
//
//   - everyone already marked in this session (including make-up students,
//     and students who have changed groups since: the record is history),
//   - plus the group's current students who had joined by that day (a
//     student added this week must not appear on last month's sheet, or
//     saving it would mark them for a class before they joined).
//
// sessionId null: nothing saved yet, so only the second part applies.
// Group members first, then make-ups, each alphabetical.
export async function findSheetStudents(
  teacherId: string,
  groupId: string,
  sessionId: string | null,
  day: string
): Promise<SheetStudentRow[]> {
  const result = await pool.query<SheetStudentRow>(
    `
      SELECT
        s.id::text AS id,
        s.code,
        s.full_name AS name,
        gr.name AS group_name,
        r.status,
        r.reason,
        COALESCE(r.is_make_up, false) AS is_make_up
      FROM students s
      JOIN groups gr ON gr.id = s.group_id
      LEFT JOIN attendance_records r
        ON r.student_id = s.id AND r.session_id = $3::bigint
      WHERE s.teacher_id = $1
        AND (
          r.session_id IS NOT NULL
          OR (
            s.group_id = $2
            AND (s.created_at AT TIME ZONE 'Africa/Cairo')::date <= $4::date
          )
        )
      ORDER BY COALESCE(r.is_make_up, false), s.full_name, s.id
    `,
    [teacherId, groupId, sessionId, day]
  );

  return result.rows;
}

/* ---------------------------------- Save ---------------------------------- */

export type RecordToSave = {
  studentId: string;
  status: AttendanceStatus;
  reason: string | null;
};

export type SaveSheetResult =
  { status: 'saved'; sessionId: string } | { status: 'student-not-found' };

// Saves a whole sheet, as ONE transaction: either every mark is saved, or
// nothing changed at all (no half-saved class).
//
// 1. Find or create the session. ON CONFLICT on (group_id, held_on) makes
//    "find or create" a single statement: two saves at the same moment can't
//    create two sessions. DO UPDATE (instead of DO NOTHING) also locks the
//    session's row, so those two saves run one after the other.
//    Saving an existing sheet on a later day stamps edited_at.
//
// 2. Save every mark in one statement (unnest = the arrays as rows). The
//    JOIN on students keeps only this teacher's students of this grade; if
//    fewer rows were saved than sent, someone didn't belong: undo it all.
//    is_make_up is decided NOW (their group vs the session's group) and only
//    on insert: an existing record keeps it, so history doesn't change if
//    the student moves groups later.
//
// 3. Remove marks for students no longer on the sheet: the sheet sent is
//    the whole truth for this session (PUT replaces).
export async function saveSheet(
  teacherId: string,
  group: { gradeId: string; groupId: string },
  day: string,
  records: RecordToSave[]
): Promise<SaveSheetResult> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const session = await client.query<{ id: string }>(
      `
        INSERT INTO class_sessions (teacher_id, grade_id, group_id, held_on)
        VALUES ($1, $2, $3, $4::date)
        ON CONFLICT ON CONSTRAINT class_sessions_group_id_held_on_unique
        DO UPDATE SET edited_at = CASE
          WHEN (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Cairo')::date > class_sessions.held_on
            THEN CURRENT_TIMESTAMP
          ELSE class_sessions.edited_at
        END
        RETURNING id::text AS id
      `,
      [teacherId, group.gradeId, group.groupId, day]
    );

    // INSERT ... ON CONFLICT DO UPDATE ... RETURNING always returns the row.
    const sessionId = session.rows[0]!.id;

    const studentIds = records.map((record) => record.studentId);

    const saved = await client.query(
      `
        INSERT INTO attendance_records (session_id, student_id, grade_id, status, reason, is_make_up)
        SELECT $1, s.id, s.grade_id, x.status, x.reason, s.group_id <> $2
        FROM unnest($3::bigint[], $4::text[], $5::text[]) AS x (student_id, status, reason)
        JOIN students s ON s.id = x.student_id
        WHERE s.teacher_id = $6 AND s.grade_id = $7
        ON CONFLICT (session_id, student_id) DO UPDATE
        SET status = EXCLUDED.status,
            reason = EXCLUDED.reason,
            marked_at = CURRENT_TIMESTAMP
      `,
      [
        sessionId,
        group.groupId,
        studentIds,
        records.map((record) => record.status),
        records.map((record) => record.reason),
        teacherId,
        group.gradeId,
      ]
    );

    if ((saved.rowCount ?? 0) !== records.length) {
      await client.query('ROLLBACK');
      return { status: 'student-not-found' };
    }

    await client.query(
      `
        DELETE FROM attendance_records
        WHERE session_id = $1 AND NOT (student_id = ANY ($2::bigint[]))
      `,
      [sessionId, studentIds]
    );

    await client.query('COMMIT');

    return { status: 'saved', sessionId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
