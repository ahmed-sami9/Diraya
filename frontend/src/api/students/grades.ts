import { apiRequest } from '../apiClient';

// The grades of the signed-in teacher.
//
// Backend endpoints (backend/src/modules/grades):
//
//   GET    /teacher/grades            -> 200 { grades: GradeSummary[] }
//   POST   /teacher/grades            -> 201 { grade: GradeSummary }
//   PATCH  /teacher/grades/:gradeId   -> 200 { grade: GradeSummary }
//   DELETE /teacher/grades/:gradeId   -> 204
//
// Error codes the server sends back (read them from ApiError.code):
//
//   INVALID_INPUT        400  the name or fee failed validation
//   GRADE_NOT_FOUND      404  no grade with this id for this teacher
//   GRADE_NAME_TAKEN     409  this teacher already has a grade with the name
//   GRADE_HAS_STUDENTS   409  delete refused: the grade still has students

export type GradeSummary = {
  id: string;
  name: string;
  // Whole Egyptian pounds. null means "use the default fee from Settings".
  monthlyFee: number | null;
  studentCount: number;
  groupCount: number;
  // The soonest upcoming session across all the grade's groups.
  // null until the grade has a group with a schedule.
  nextSession: {
    // ISO 8601 date and time, for example "2026-10-09T18:00:00.000Z".
    startsAt: string;
    groupName: string;
  } | null;
  // The most recent session that took place, with its attendance.
  // null until attendance has been taken at least once.
  lastSession: {
    heldAt: string;
    groupName: string;
    presentCount: number;
    totalCount: number;
  } | null;
};

// What the "Add grade" and "Edit grade" forms send.
export type GradeInput = {
  name: string;
  monthlyFee: number | null;
};

export async function getGrades(signal?: AbortSignal): Promise<GradeSummary[]> {
  const data = await apiRequest<{ grades: GradeSummary[] }>('GET', '/teacher/grades', {
    signal,
  });

  return data.grades;
}

export async function createGrade(input: GradeInput): Promise<GradeSummary> {
  const data = await apiRequest<{ grade: GradeSummary }>('POST', '/teacher/grades', {
    body: input,
  });

  return data.grade;
}

export async function updateGrade(gradeId: string, input: GradeInput): Promise<GradeSummary> {
  const data = await apiRequest<{ grade: GradeSummary }>(
    'PATCH',
    `/teacher/grades/${encodeURIComponent(gradeId)}`,
    { body: input }
  );

  return data.grade;
}

export async function deleteGrade(gradeId: string): Promise<void> {
  await apiRequest<null>('DELETE', `/teacher/grades/${encodeURIComponent(gradeId)}`);
}
