import { isCheckViolation } from '../../errors/pgErrors';
import { todayInCairo } from '../../utils/cairoDate';

import { GradeErrors } from '../grades/grades.errors';

import { ExamErrors } from './exams.errors';
import {
  deleteExam,
  findExam,
  findExamResults,
  findExamSummaries,
  findExamSummary,
  findGradeGroups,
  insertExam,
  saveResults,
  updateExam,
  type ExamRow,
  type ExamSummaryRow,
} from './exams.repository';
import type { CreateExamInput, SaveResultsInput, UpdateExamInput } from './exams.validation';

// Exams and their results: the rules, and the shape of the API's answers.
//
// The types below must match the frontend's (frontend/src/api/exams/exams.ts)
// field for field.

/* ---------------------------------- Types --------------------------------- */

export type Exam = {
  id: string;
  title: string;
  kind: 'exam' | 'quiz';
  heldOn: string;
  maxMark: number;
  passMark: number;
  grade: { id: string; name: string };
};

export type ExamSummary = Exam & {
  results: {
    entered: number;
    total: number;
    averagePercent: number | null;
    failed: number;
    fullMarks: number;
  };
};

export type ExamDetail = {
  exam: Exam;
  groups: { id: string; name: string }[];
  results: {
    student: { id: string; name: string; code: string };
    group: { id: string; name: string };
    status: 'scored' | 'absent' | 'not-entered';
    score: number | null;
  }[];
};

/* --------------------------------- Shaping -------------------------------- */

const toExam = (row: ExamRow): Exam => ({
  id: row.id,
  title: row.title,
  kind: row.kind,
  heldOn: row.held_on,
  maxMark: row.max_mark,
  passMark: row.pass_mark,
  grade: { id: row.grade_id, name: row.grade_name },
});

// The average as a rounded percent of "out of": the same rule as the
// frontend's summarizeResults(), so the list and the exam page agree.
const toSummary = (row: ExamSummaryRow): ExamSummary => ({
  ...toExam(row),
  results: {
    entered: row.entered,
    total: row.total,
    averagePercent:
      row.average_score === null ? null : Math.round((row.average_score / row.max_mark) * 100),
    failed: row.failed,
    fullMarks: row.full_marks,
  },
});

/* -------------------------------- Functions ------------------------------- */

// GET /teacher/exams
export async function getExams(teacherId: string): Promise<ExamSummary[]> {
  const rows = await findExamSummaries(teacherId);

  return rows.map(toSummary);
}

// GET /teacher/exams/:examId
//
// The raw rows, not a summary: the page works out the average, the spread
// and each group's numbers from them, so its parts can't disagree.
export async function getExamDetail(teacherId: string, examId: string): Promise<ExamDetail> {
  const exam = await findExam(teacherId, examId);

  if (!exam) throw ExamErrors.notFound();

  // Both only read, and both only need the exam: run them side by side.
  const [groups, rows] = await Promise.all([
    findGradeGroups(exam.grade_id),
    findExamResults(teacherId, examId),
  ]);

  return {
    exam: toExam(exam),
    groups,
    results: rows.map((row) => ({
      student: { id: row.student_id, name: row.student_name, code: row.student_code },
      group: { id: row.group_id, name: row.group_name },
      // No row in the database = "not entered yet".
      status: row.status ?? 'not-entered',
      score: row.score,
    })),
  };
}

// POST /teacher/exams
export async function createExam(teacherId: string, input: CreateExamInput): Promise<ExamSummary> {
  const { gradeId, ...fields } = input;

  // null: the grade isn't this teacher's (or was deleted).
  const examId = await insertExam(teacherId, gradeId, fields);

  if (!examId) throw GradeErrors.notFound();

  const summary = await findExamSummary(teacherId, examId);

  // Just inserted in this request; only a delete in between could hide it.
  if (!summary) throw ExamErrors.notFound();

  return toSummary(summary);
}

// PATCH /teacher/exams/:examId
//
// Answers with the whole page: a new date can change who is on the exam,
// and a new pass mark changes who failed.
export async function editExam(
  teacherId: string,
  examId: string,
  input: UpdateExamInput
): Promise<ExamDetail> {
  let outcome;

  try {
    outcome = await updateExam(teacherId, examId, input, todayInCairo());
  } catch (error) {
    // The database refused to lower "out of" below a saved mark (the
    // ON UPDATE CASCADE ran the results' CHECK). Explain it in words.
    if (isCheckViolation(error, 'exam_results_score_check')) {
      throw ExamErrors.scoresAboveMaxMark(input.maxMark);
    }
    throw error;
  }

  if (outcome === 'not-found') throw ExamErrors.notFound();
  if (outcome === 'results-on-future-date') throw ExamErrors.resultsOnFutureDate();

  return getExamDetail(teacherId, examId);
}

// DELETE /teacher/exams/:examId
export async function removeExam(teacherId: string, examId: string): Promise<void> {
  const deleted = await deleteExam(teacherId, examId);

  if (!deleted) throw ExamErrors.notFound();
}

// PUT /teacher/exams/:examId/results
//
// Saves the listed students only, then answers with the fresh page (so the
// screen shows exactly what was stored). Saving the same thing twice
// changes nothing more.
export async function saveExamResults(
  teacherId: string,
  examId: string,
  input: SaveResultsInput
): Promise<ExamDetail> {
  const outcome = await saveResults(
    teacherId,
    examId,
    input.results.map((item) =>
      item.status === 'scored'
        ? { studentId: item.studentId, status: 'scored', score: item.score }
        : { studentId: item.studentId, status: item.status }
    ),
    todayInCairo()
  );

  switch (outcome.status) {
    case 'not-found':
      throw ExamErrors.notFound();
    case 'date-in-future':
      throw ExamErrors.dateInFuture();
    case 'score-above-max':
      throw ExamErrors.scoreAboveMaxMark(outcome.maxMark);
    case 'student-not-found':
      throw ExamErrors.studentNotFound();
    case 'saved':
      return getExamDetail(teacherId, examId);
  }
}
