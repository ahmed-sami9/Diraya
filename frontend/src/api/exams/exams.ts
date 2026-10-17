import { apiRequest } from '../apiClient';

// Exams, quizzes and their results, for the signed-in teacher.
//
// Backend endpoints (backend/src/modules/exams, not built yet):
//
//   GET    /teacher/exams                   -> 200 { exams: ExamSummary[] }
//   POST   /teacher/exams                   -> 201 { exam: ExamSummary }
//   GET    /teacher/exams/:examId           -> 200 ExamDetail
//   PATCH  /teacher/exams/:examId           -> 200 ExamDetail (the date can change who's on it)
//   DELETE /teacher/exams/:examId           -> 204 (its results go with it)
//   PUT    /teacher/exams/:examId/results   -> 200 ExamDetail (the fresh page)
//
// Error codes the server sends back (read them from ApiError.code):
//
//   INVALID_INPUT          400  a field failed validation
//   EXAM_NOT_FOUND         404  no exam with this id for this teacher
//   GRADE_NOT_FOUND        404  create: no grade with this id for this teacher
//   SCORES_ABOVE_MAX_MARK  409  edit: lowering "Out of" below marks already entered
//   SCORE_ABOVE_MAX_MARK   400  results: a mark higher than the exam's "Out of"
//   STUDENT_NOT_FOUND      400  results: a student who isn't in the exam's grade

// "YYYY-MM-DD", a day in Egypt's calendar.
export type IsoDay = string;

export type ExamKind = 'exam' | 'quiz';

// The exam itself: what the teacher typed in the Add exam form.
export type Exam = {
  id: string;
  title: string;
  kind: ExamKind;
  heldOn: IsoDay;
  // Marks allow halves (31.5). maxMark is a whole number.
  maxMark: number;
  passMark: number;
  grade: { id: string; name: string };
};

// One row of the exams list: the exam and its results, counted by the server
// (the list can't download every mark of every exam).
export type ExamSummary = Exam & {
  results: {
    // Students with a result: a mark OR "absent".
    entered: number;
    // Students expected to sit it (see "Who is on an exam" below).
    total: number;
    // Of the students who sat it, rounded. null until a mark is entered.
    averagePercent: number | null;
    // score < passMark
    failed: number;
    // score === maxMark
    fullMarks: number;
  };
};

// What the Add exam form sends.
export type ExamInput = {
  title: string;
  kind: ExamKind;
  gradeId: string;
  heldOn: IsoDay;
  maxMark: number;
  passMark: number;
};

// What the Edit form sends. The grade can't change: the results belong to
// that grade's students. (Wrong grade? Delete it and add it again.)
export type ExamUpdate = Omit<ExamInput, 'gradeId'>;

// A student's result on one exam, as three states, not two:
//   scored       a row with a score
//   absent       a row with no score: they missed the exam
//   not-entered  no row yet: the teacher hasn't typed it
// "Absent" and "not entered" must stay apart: one is a fact about the
// student, the other is work the teacher still has to do.
export type ExamResultStatus = 'scored' | 'absent' | 'not-entered';

export type ExamResultRow = {
  student: { id: string; name: string; code: string };
  // The student's group now (students can move between groups).
  group: { id: string; name: string };
  status: ExamResultStatus;
  // A number only when status is 'scored'.
  score: number | null;
};

// Everything the exam page needs, in one request.
//
// Who is on an exam: every student with a result, plus the grade's current
// students who joined on or before the exam day. (Someone who joined after
// it never sat it, so they're not "not entered".) The list's `total` uses
// the same rule, so both pages agree.
//
// The summary (average, failed, spread, by group) is NOT sent: the page
// works it out from these rows, so it can never disagree with them.
export type ExamDetail = {
  exam: Exam;
  // All the grade's groups, for the filter.
  groups: { id: string; name: string }[];
  results: ExamResultRow[];
};

// What "Save marks" sends for one group: only the students it lists change.
//   status 'not-entered' removes a result (the teacher cleared the box).
export type ExamResultInput = {
  studentId: string;
  status: ExamResultStatus;
  score: number | null;
};

const examPath = (examId: string) => `/teacher/exams/${encodeURIComponent(examId)}`;

export async function getExams(signal?: AbortSignal): Promise<ExamSummary[]> {
  const data = await apiRequest<{ exams: ExamSummary[] }>('GET', '/teacher/exams', { signal });

  return data.exams;
}

export async function createExam(input: ExamInput): Promise<ExamSummary> {
  const data = await apiRequest<{ exam: ExamSummary }>('POST', '/teacher/exams', { body: input });

  return data.exam;
}

export function getExam(examId: string, signal?: AbortSignal): Promise<ExamDetail> {
  return apiRequest<ExamDetail>('GET', examPath(examId), { signal });
}

// Returns the whole page, not just the exam: a new date can change who is
// on the exam, and a new pass mark changes who failed.
export function updateExam(examId: string, input: ExamUpdate): Promise<ExamDetail> {
  return apiRequest<ExamDetail>('PATCH', examPath(examId), { body: input });
}

export async function deleteExam(examId: string): Promise<void> {
  await apiRequest<null>('DELETE', examPath(examId));
}

// Used by the Enter marks page (next step).
export function saveExamResults(examId: string, results: ExamResultInput[]): Promise<ExamDetail> {
  return apiRequest<ExamDetail>('PUT', `${examPath(examId)}/results`, { body: { results } });
}
