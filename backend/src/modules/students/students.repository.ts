import { pool } from '../../config/db';

export type StudentSearchRow = {
  id: string;
  name: string;
  grade_name: string;
  group_name: string | null;
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
// Omran), then alphabetical. LEFT JOIN on groups because a student may not be
// in a group yet.
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
      LEFT JOIN groups gr ON gr.id = s.group_id
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
