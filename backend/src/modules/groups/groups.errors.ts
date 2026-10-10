import { AppError } from '../../errors/AppError';

// Every error the groups module throws on purpose. The codes are the ones the
// frontend reads in api/students/groups.ts.
export const GroupErrors = {
  // Also used when the group belongs to another teacher, or (when adding a
  // student) to another grade: never confirm that someone else's id exists.
  notFound: () => new AppError(404, 'GROUP_NOT_FOUND', 'This group no longer exists.'),

  nameTaken: () =>
    new AppError(409, 'GROUP_NAME_TAKEN', 'This grade already has a group with this name.'),

  // Every student must be in a group, so a group's students have to go
  // somewhere first (DELETE ...?moveStudentsTo=<groupId>).
  hasStudents: () =>
    new AppError(
      409,
      'GROUP_HAS_STUDENTS',
      'This group still has students. Choose a group to move them to first.'
    ),

  // A grade always keeps at least one group, so "Add student" always has
  // somewhere to put them.
  isLastGroup: () =>
    new AppError(
      409,
      'GROUP_IS_LAST',
      'A grade needs at least one group. Rename this one instead of deleting it.'
    ),

  // The group picked to receive the students is gone, is the same group, or
  // is in another grade.
  moveTargetNotFound: () =>
    new AppError(404, 'MOVE_TARGET_NOT_FOUND', 'The group you picked no longer exists.'),
};
