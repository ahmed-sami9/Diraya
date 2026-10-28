import { pool } from '../../config/db';

// SQL for the teacher's own notes (My notes, table teacher_notes). Every
// query filters by teacherId, so a guessed id never reaches another
// teacher's note. Notes about a student are in students/profile.

export type TeacherNoteRow = {
  id: string;
  text: string;
  pinned: boolean;
  created_at: Date;
  updated_at: Date;
};

const COLUMNS = 'id::text AS id, text, pinned, created_at, updated_at';

// The list's one order, everywhere: pinned first, then newest. id breaks
// ties between notes saved in the same instant, so the order never wobbles.
const ORDER = 'pinned DESC, created_at DESC, id DESC';

// The teacher's notes, and how many they have in all. `limit` (the Home
// card) cuts the list, not the count: COUNT(*) OVER () is worked out before
// LIMIT, so one query answers both. limit null = every note.
export async function findTeacherNotes(
  teacherId: string,
  limit: number | null
): Promise<{ notes: TeacherNoteRow[]; total: number }> {
  const result = await pool.query<TeacherNoteRow & { total: number }>(
    `
      SELECT ${COLUMNS}, COUNT(*) OVER ()::int AS total
      FROM teacher_notes
      WHERE teacher_id = $1
      ORDER BY ${ORDER}
      LIMIT $2
    `,
    [teacherId, limit]
  );

  return {
    notes: result.rows.map(({ total: _total, ...note }) => note),
    // No rows means no notes at all: limit is always 1 or more (validation).
    total: result.rows[0]?.total ?? 0,
  };
}

export async function insertTeacherNote(teacherId: string, text: string): Promise<TeacherNoteRow> {
  const result = await pool.query<TeacherNoteRow>(
    `
      INSERT INTO teacher_notes (teacher_id, text)
      VALUES ($1, $2)
      RETURNING ${COLUMNS}
    `,
    [teacherId, text]
  );

  return result.rows[0]!;
}

export type TeacherNoteChanges = {
  text?: string;
  pinned?: boolean;
};

// Changes the text, the pin, or both; a field left out keeps its value.
// updated_at moves only when the text really changes: pinning, or saving
// the same text again, is not an edit. null = no such note for this teacher.
export async function updateTeacherNote(
  teacherId: string,
  noteId: string,
  changes: TeacherNoteChanges
): Promise<TeacherNoteRow | null> {
  const result = await pool.query<TeacherNoteRow>(
    `
      UPDATE teacher_notes
      SET text = COALESCE($3::varchar, text),
          pinned = COALESCE($4::boolean, pinned),
          updated_at = CASE
            WHEN $3::varchar IS NOT NULL AND $3::varchar <> text THEN CURRENT_TIMESTAMP
            ELSE updated_at
          END
      WHERE teacher_id = $1 AND id = $2
      RETURNING ${COLUMNS}
    `,
    [teacherId, noteId, changes.text ?? null, changes.pinned ?? null]
  );

  return result.rows[0] ?? null;
}

// true when a note was deleted; false when there's no such note for this teacher.
export async function deleteTeacherNote(teacherId: string, noteId: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM teacher_notes WHERE teacher_id = $1 AND id = $2',
    [teacherId, noteId]
  );

  return result.rowCount === 1;
}
