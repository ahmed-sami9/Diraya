import { AppError } from '../../errors/AppError';

// Every error the attendance module throws on purpose. The codes are the
// ones the frontend reads (api/attendance/attendance.ts).
export const AttendanceErrors = {
  // The teacher has no groups at all: there is no sheet to show.
  noGroups: () =>
    new AppError(404, 'NO_GROUPS', 'Add a grade and its students before taking attendance.'),

  // Attendance records what happened. A day that hasn't come yet has
  // nothing to record.
  dateInFuture: () =>
    new AppError(
      400,
      'DATE_IN_FUTURE',
      'Attendance can’t be taken for a day that hasn’t come yet.'
    ),

  // A record names a student who isn't this teacher's, or isn't in the
  // session's grade. Same answer for both: never confirm someone else's id.
  studentNotFound: () =>
    new AppError(
      404,
      'STUDENT_NOT_FOUND',
      'One of these students isn’t in this grade any more. Reload the sheet and try again.'
    ),
};
