import { apiRequest } from '../apiClient';
import type { GradeSummary } from './grades';

// The groups inside a grade ("Group A", "Saturday group").
//
// Backend endpoints (backend/src/modules/groups):
//
//   POST   /teacher/grades/:gradeId/groups                  -> 201 { group: GroupSummary }
//   PATCH  /teacher/groups/:groupId                         -> 200 { group: GroupSummary }
//   PUT    /teacher/groups/:groupId/schedule                -> 200 { group, grade }
//   DELETE /teacher/groups/:groupId?moveStudentsTo=:groupId -> 204
//
// A group is the class: every student is in one, and every grade keeps at
// least one (a new grade starts with "Group 1"). So deleting a group with
// students needs another group of the same grade to move them to.
//
// Error codes the server sends back (read them from ApiError.code):
//
//   INVALID_INPUT        400  the name or the schedule failed validation
//   GRADE_NOT_FOUND      404  no grade with this id for this teacher
//   GROUP_NOT_FOUND      404  no group with this id for this teacher
//   GROUP_NAME_TAKEN     409  the grade already has a group with this name
//   GROUP_HAS_STUDENTS   409  deleting a group with students, without moveStudentsTo
//   GROUP_IS_LAST        409  deleting the grade's only group
//   MOVE_TARGET_NOT_FOUND 404 moveStudentsTo is gone, is the same group, or another grade's

// One weekly session of a group, for example every Saturday at 4 pm.
export type GroupSession = {
  // 0 = Sunday … 6 = Saturday, the same numbering as JavaScript's Date.
  dayOfWeek: number;
  // 24-hour "HH:MM", in the teacher's local time: "16:00".
  startTime: string;
};

export type GroupSummary = {
  id: string;
  name: string;
  // Empty until the teacher sets the group's weekly schedule.
  sessions: GroupSession[];
};

// What the "Add group" and "Rename group" forms send.
export type GroupInput = {
  name: string;
};

export async function createGroup(gradeId: string, input: GroupInput): Promise<GroupSummary> {
  const data = await apiRequest<{ group: GroupSummary }>(
    'POST',
    `/teacher/grades/${encodeURIComponent(gradeId)}/groups`,
    { body: input }
  );

  return data.group;
}

export async function renameGroup(groupId: string, input: GroupInput): Promise<GroupSummary> {
  const data = await apiRequest<{ group: GroupSummary }>(
    'PATCH',
    `/teacher/groups/${encodeURIComponent(groupId)}`,
    { body: input }
  );

  return data.group;
}

// Replaces the group's whole weekly schedule (an empty list clears it).
// Answers with the group AND its grade: the grade's "next class" is worked out
// from all its groups' schedules, so it changes too.
export async function saveGroupSchedule(
  groupId: string,
  sessions: GroupSession[]
): Promise<{ group: GroupSummary; grade: GradeSummary }> {
  return apiRequest<{ group: GroupSummary; grade: GradeSummary }>(
    'PUT',
    `/teacher/groups/${encodeURIComponent(groupId)}/schedule`,
    { body: { sessions } }
  );
}

// moveStudentsTo: the group that receives this group's students. Needed only
// when the group has students.
export async function deleteGroup(groupId: string, moveStudentsTo: string | null): Promise<void> {
  const query = moveStudentsTo ? `?${new URLSearchParams({ moveStudentsTo })}` : '';

  await apiRequest<null>('DELETE', `/teacher/groups/${encodeURIComponent(groupId)}${query}`);
}
