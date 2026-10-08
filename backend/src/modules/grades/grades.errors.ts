import { AppError } from '../../errors/AppError';

// Every error the grades module throws on purpose. The codes are the ones
// the frontend reads in api/students/grades.ts.
export const GradeErrors = {
  // Also used when the grade belongs to another teacher: saying "not yours"
  // would confirm that the id exists.
  notFound: () => new AppError(404, 'GRADE_NOT_FOUND', 'This grade no longer exists.'),

  nameTaken: () =>
    new AppError(409, 'GRADE_NAME_TAKEN', 'You already have a grade with this name.'),

  hasStudents: () =>
    new AppError(
      409,
      'GRADE_HAS_STUDENTS',
      'This grade still has students. Move or remove them first, then delete the grade.'
    ),
};
