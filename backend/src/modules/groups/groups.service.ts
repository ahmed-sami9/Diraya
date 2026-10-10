import { isForeignKeyViolation, isUniqueViolation } from '../../errors/pgErrors';

import { GradeErrors } from '../grades/grades.errors';

import { GroupErrors } from './groups.errors';
import type { GroupInput } from './groups.validation';
import {
  deleteGroupMovingStudents,
  findGroupsByGrade,
  insertGroup,
  updateGroupName,
  type GroupRow,
} from './groups.repository';

// Must match the index in migrations/…_create-groups.js.
const NAME_UNIQUE_INDEX = 'groups_grade_id_name_unique';
// Must match migrations/…_require-student-group.js.
const STUDENT_GROUP_FOREIGN_KEY = 'students_group_in_grade_fkey';

// What the API sends for each group. Matches GroupSummary on the frontend.
export type GroupSummary = {
  id: string;
  name: string;
  sessions: { dayOfWeek: number; startTime: string }[];
};

// The weekly schedule gets its own table with the schedule form. Until then
// every group answers "no sessions", which the frontend shows as
// "No schedule yet", so the API shape doesn't change when it arrives.
function toGroupSummary(row: GroupRow): GroupSummary {
  return { id: row.id, name: row.name, sessions: [] };
}

export async function listGroups(teacherId: string, gradeId: string): Promise<GroupSummary[]> {
  const rows = await findGroupsByGrade(teacherId, gradeId);

  return rows.map(toGroupSummary);
}

export async function createGroup(
  teacherId: string,
  gradeId: string,
  input: GroupInput
): Promise<GroupSummary> {
  let row: GroupRow | null;

  try {
    row = await insertGroup(teacherId, gradeId, input.name);
  } catch (error) {
    if (isUniqueViolation(error, NAME_UNIQUE_INDEX)) throw GroupErrors.nameTaken();
    throw error;
  }

  if (!row) throw GradeErrors.notFound();

  return toGroupSummary(row);
}

export async function renameGroup(
  teacherId: string,
  groupId: string,
  input: GroupInput
): Promise<GroupSummary> {
  let row: GroupRow | null;

  try {
    row = await updateGroupName(teacherId, groupId, input.name);
  } catch (error) {
    if (isUniqueViolation(error, NAME_UNIQUE_INDEX)) throw GroupErrors.nameTaken();
    throw error;
  }

  if (!row) throw GroupErrors.notFound();

  return toGroupSummary(row);
}

// Deletes a group. If it has students, `moveStudentsTo` says which group of
// the same grade receives them; without it, a group with students is refused.
export async function removeGroup(
  teacherId: string,
  groupId: string,
  moveStudentsTo: string | null
): Promise<void> {
  let result: Awaited<ReturnType<typeof deleteGroupMovingStudents>>;

  try {
    result = await deleteGroupMovingStudents(teacherId, groupId, moveStudentsTo);
  } catch (error) {
    // A student was added to this group in the split second between the
    // check and the delete; the foreign key caught it.
    if (isForeignKeyViolation(error, STUDENT_GROUP_FOREIGN_KEY)) throw GroupErrors.hasStudents();
    throw error;
  }

  switch (result.status) {
    case 'deleted':
      return;
    case 'not-found':
      throw GroupErrors.notFound();
    case 'last-group':
      throw GroupErrors.isLastGroup();
    case 'has-students':
      throw GroupErrors.hasStudents();
    case 'target-not-found':
      throw GroupErrors.moveTargetNotFound();
  }
}
