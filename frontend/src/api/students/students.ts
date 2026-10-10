import { apiRequest } from '../apiClient';

// Students: the navbar search, and the students of one grade.
//
// Backend endpoints (backend/src/modules/students):
//
//   GET  /teacher/students/search?q=om          -> 200 { students: StudentSearchResult[] }
//   GET  /teacher/grades/:gradeId/students      -> 200 { students: GradeStudent[] }
//   POST /teacher/grades/:gradeId/students      -> 201 { student: GradeStudent }
//
// Error codes for adding a student (read them from ApiError.code):
//
//   INVALID_INPUT        400  a field failed validation
//   GRADE_NOT_FOUND      404  no grade with this id for this teacher
//   GROUP_NOT_FOUND      404  the group doesn't exist, or belongs to another grade
//
// Every student is in exactly one group of their grade.
//
// The server matches any part of the name, ignores upper/lower case, only
// searches this teacher's students, and returns at most 8 results.

export type StudentSearchResult = {
  id: string;
  name: string;
  gradeName: string;
  groupName: string;
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

// This month's fee: paid in full, paid part of it, or nothing yet.
export type PaymentStatus = 'paid' | 'partial' | 'unpaid';

// One row of a grade's student table. Only what the table shows: everything
// else (phones, notes, full history) lives on the student's profile.
export type GradeStudent = {
  id: string;
  // The human-friendly code: year joined + running number, e.g. "26-0042".
  // Given by the server when the student is added, and never changes.
  code: string;
  name: string;
  groupId: string;
  // ISO date the student was added.
  joinedAt: string;

  // The quick summary, for skimming the whole grade. null = no data yet
  // (always null until attendance, exams and payments are built).
  //
  // % of their group's sessions attended, 0-100.
  attendanceRate: number | null;
  // Average of their exam marks, as a %, 0-100.
  averageMark: number | null;
  paymentStatus: PaymentStatus | null;
};

// What the "Add student" form sends. Phones are digits only, e.g. "01012345678".
export type StudentInput = {
  fullName: string;
  parentPhone: string;
  phone: string | null;
  groupId: string;
  notes: string | null;
};

export async function getGradeStudents(
  gradeId: string,
  signal?: AbortSignal
): Promise<GradeStudent[]> {
  const data = await apiRequest<{ students: GradeStudent[] }>(
    'GET',
    `/teacher/grades/${encodeURIComponent(gradeId)}/students`,
    { signal }
  );

  return data.students;
}

export async function createStudent(gradeId: string, input: StudentInput): Promise<GradeStudent> {
  const data = await apiRequest<{ student: GradeStudent }>(
    'POST',
    `/teacher/grades/${encodeURIComponent(gradeId)}/students`,
    { body: input }
  );

  return data.student;
}
