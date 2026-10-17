import { AppError } from '../../errors/AppError';

// Every error the exams module throws on purpose. The codes are the ones the
// frontend reads (frontend/src/api/exams/exams.ts).
export const ExamErrors = {
  // Also used for another teacher's exam: saying "not yours" would confirm
  // that the id exists.
  notFound: () => new AppError(404, 'EXAM_NOT_FOUND', 'This exam no longer exists.'),

  // Marks record what happened. An exam that hasn't happened has none.
  dateInFuture: () =>
    new AppError(400, 'DATE_IN_FUTURE', 'Marks can be entered from the exam day.'),

  // Edit: moving an exam that already has marks to a day that hasn't come.
  resultsOnFutureDate: () =>
    new AppError(
      400,
      'DATE_IN_FUTURE',
      'This exam already has marks, so it can’t move to a day that hasn’t come yet.'
    ),

  // Edit: lowering "out of" below a mark that's already saved. The form
  // shows this under the "Out of" field.
  scoresAboveMaxMark: (maxMark: number) =>
    new AppError(
      409,
      'SCORES_ABOVE_MAX_MARK',
      `Some saved marks are higher than ${maxMark}. Change those marks first.`
    ),

  // Saving marks: a mark above "out of".
  scoreAboveMaxMark: (maxMark: number) =>
    new AppError(400, 'SCORE_ABOVE_MAX_MARK', `The highest mark is ${maxMark}.`),

  // Saving marks: a student who isn't this teacher's, or isn't in the
  // exam's grade. Same answer for both: never confirm someone else's id.
  studentNotFound: () =>
    new AppError(
      400,
      'STUDENT_NOT_FOUND',
      'One of these students isn’t in this grade any more. Reload the page and try again.'
    ),
};
