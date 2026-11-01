import { AppError } from '../../errors/AppError';

// Every error the students module throws on purpose. The codes are the ones
// the frontend reads (api/students/profile.ts).
export const StudentErrors = {
  // Also used when the student belongs to another teacher: never confirm
  // that someone else's id exists.
  notFound: () => new AppError(404, 'STUDENT_NOT_FOUND', 'This student no longer exists.'),
  // Deleting would also delete payments, and the request didn't say it may.
  hasPayments: () =>
    new AppError(
      409,
      'STUDENT_HAS_PAYMENTS',
      'This student has payments recorded. Confirm that their payments should be deleted too.'
    ),
};
