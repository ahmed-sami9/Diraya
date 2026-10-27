import { isForeignKeyViolation, isUniqueViolation } from '../../errors/pgErrors';

import { GradeErrors } from '../grades/grades.errors';

import { GroupErrors } from './groups.errors';
import type { GroupInput } from './groups.validation';
import {
  deleteGroupMovingStudents,
  findGroupsByGrade,
  findSchedulesByGroups,
  insertGroup,
  updateGroupName,
  type GroupRow,
  type ScheduleSlot,
} from './groups.repository';

// Must match the index in migrations/…_create-groups.js.
const NAME_UNIQUE_INDEX = 'groups_grade_id_name_unique';
// Must match migrations/…_require-student-group.js.
const STUDENT_GROUP_FOREIGN_KEY = 'students_group_in_grade_fkey';
// Must match migrations/…_create-attendance.js.
const SESSION_GROUP_FOREIGN_KEY = 'class_sessions_group_in_grade_fkey';

// One weekly class, as the API sends it. Matches GroupSession on the frontend.
export type GroupSession = { dayOfWeek: number; startTime: string };

// What the API sends for each group. Matches GroupSummary on the frontend.
export type GroupSummary = {
  id: string;
  name: string;
  sessions: GroupSession[];
};

// The database says "weekday", the API "dayOfWeek" (the name the frontend
// already used): mapped here, like full_name -> name.
export const toSessions = (slots: ScheduleSlot[]): GroupSession[] =>
  slots.map((slot) => ({ dayOfWeek: slot.weekday, startTime: slot.startTime }));

function toGroupSummary(row: GroupRow, slots: ScheduleSlot[]): GroupSummary {
  return { id: row.id, name: row.name, sessions: toSessions(slots) };
}

// The groups' timetables, read in ONE query and handed back per group.
async function withSchedules(teacherId: string, rows: GroupRow[]): Promise<GroupSummary[]> {
  const slots = await findSchedulesByGroups(
    teacherId,
    rows.map((row) => row.id)
  );

  return rows.map((row) =>
    toGroupSummary(
      row,
      slots.filter((slot) => slot.groupId === row.id)
    )
  );
}

export async function listGroups(teacherId: string, gradeId: string): Promise<GroupSummary[]> {
  const rows = await findGroupsByGrade(teacherId, gradeId);

  return withSchedules(teacherId, rows);
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

  // A group that was just created has no timetable yet.
  return toGroupSummary(row, []);
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

  // Answer with the group's real timetable: the page replaces the group with
  // this answer, so an empty list here would wipe its days off the screen.
  const [group] = await withSchedules(teacherId, [row]);
  return group!;
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
    // The group has held sessions. The whole transaction rolled back, so any
    // students it was moving stayed where they were.
    if (isForeignKeyViolation(error, SESSION_GROUP_FOREIGN_KEY)) throw GroupErrors.hasHistory();
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
