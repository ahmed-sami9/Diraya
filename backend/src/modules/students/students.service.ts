import { searchStudentsByName } from './students.repository';

// The dropdown shows at most this many. Enough to find someone by a partial
// name; if there are more, the teacher types another letter.
const SEARCH_RESULT_LIMIT = 8;

// What the API sends for each result. Matches StudentSearchResult on the frontend.
export type StudentSearchResult = {
  id: string;
  name: string;
  gradeName: string;
  groupName: string | null;
};

export async function searchStudents(
  teacherId: string,
  text: string
): Promise<StudentSearchResult[]> {
  const rows = await searchStudentsByName(teacherId, text, SEARCH_RESULT_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    gradeName: row.grade_name,
    groupName: row.group_name,
  }));
}
