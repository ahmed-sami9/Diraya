import { apiRequest } from '../apiClient';

// Student search, used by the search box in the navbar.
//
// Backend endpoint (backend/src/modules/students):
//
//   GET /teacher/students/search?q=om  -> 200 { students: StudentSearchResult[] }
//
// The server matches any part of the name, ignores upper/lower case, only
// searches this teacher's students, and returns at most 8 results.

export type StudentSearchResult = {
  id: string;
  name: string;
  gradeName: string;
  // null while the student is not in a group yet.
  groupName: string | null;
};

export async function searchStudents(
  query: string,
  signal?: AbortSignal
): Promise<StudentSearchResult[]> {
  // URLSearchParams escapes characters such as "&" or spaces in the query.
  const params = new URLSearchParams({ q: query });

  const data = await apiRequest<{ students: StudentSearchResult[] }>(
    'GET',
    `/teacher/students/search?${params}`,
    { signal }
  );

  return data.students;
}
