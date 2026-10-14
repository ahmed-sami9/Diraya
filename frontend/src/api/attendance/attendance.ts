import { apiRequest } from '../apiClient';
import type { AttendanceStatus } from '../students/profile';

// Taking attendance: one group, one day, one sheet.
//
// Backend endpoints (to be built in backend/src/modules/attendance):
//
//   GET /teacher/attendance/options
//       -> 200 { grades: AttendanceGradeOption[] }
//       The grade and group pickers, in one request.
//
//   GET /teacher/attendance/sheet?groupId=6&date=2026-10-12
//       -> 200 { sheet: AttendanceSheet }
//       READ ONLY: never creates anything. Without groupId, the server picks
//       the default group (the one whose attendance was taken most recently;
//       later, the one whose class is on now) and says which in the answer.
//
//   PUT /teacher/attendance/sheet
//       body { groupId, date, records: [{ studentId, status, reason }] }
//       -> 200 { sheet: AttendanceSheet }
//       Finds or creates that group's session for that day and saves every
//       mark, in one transaction. Sending the same sheet twice just saves it
//       again: (groupId, date) names exactly one session.
//
// Error codes (read them from ApiError.code):
//
//   GROUP_NOT_FOUND     404  no group with this id for this teacher
//   NO_GROUPS           404  the teacher has no groups yet (nothing to take)
//   STUDENT_NOT_FOUND   404  a record names a student who isn't in this grade
//   DATE_IN_FUTURE      400  attendance can't be taken for a day not reached yet
//   INVALID_INPUT       400  the body failed validation

/* ---------------------------------- Types --------------------------------- */

// A day is "YYYY-MM-DD" in Egypt's calendar: the day the class met, with no
// time and no time zone attached.
export type IsoDay = string;

export type AttendanceGroupOption = { id: string; name: string };

export type AttendanceGradeOption = {
  id: string;
  name: string;
  groups: AttendanceGroupOption[];
};

export type SheetStudent = {
  id: string;
  code: string;
  name: string;
  // true: from another group of the same grade, attending this class.
  isMakeUp: boolean;
  // Their own group, shown next to make-up students ("from Group B").
  groupName: string;
  // The saved mark. null: not saved yet (a new sheet, or added since).
  status: AttendanceStatus | null;
  reason: string | null;
};

export type AttendanceSheet = {
  grade: { id: string; name: string };
  group: { id: string; name: string };
  date: IsoDay;
  // null: attendance hasn't been taken for this group on this day yet.
  session: {
    id: string;
    // When the sheet was first saved.
    createdAt: string;
    // Set when it was changed on a later day than the class.
    editedAt: string | null;
  } | null;
  // The group's students, plus any make-up students already saved, by name.
  students: SheetStudent[];
};

// What the Save button sends. Every student on the sheet, every time: the
// server stores exactly this list for the session.
export type AttendanceRecordInput = {
  studentId: string;
  status: AttendanceStatus;
  reason: string | null;
};

export type SaveSheetInput = {
  groupId: string;
  date: IsoDay;
  records: AttendanceRecordInput[];
};

/* -------------------------------- Requests -------------------------------- */

export async function getAttendanceOptions(signal?: AbortSignal): Promise<AttendanceGradeOption[]> {
  const data = await apiRequest<{ grades: AttendanceGradeOption[] }>(
    'GET',
    '/teacher/attendance/options',
    { signal }
  );

  return data.grades;
}

// groupId null: let the server choose the default group.
export async function getAttendanceSheet(
  { groupId, date }: { groupId: string | null; date: IsoDay },
  signal?: AbortSignal
): Promise<AttendanceSheet> {
  const params = new URLSearchParams({ date });
  if (groupId) params.set('groupId', groupId);

  const data = await apiRequest<{ sheet: AttendanceSheet }>(
    'GET',
    `/teacher/attendance/sheet?${params}`,
    { signal }
  );

  return data.sheet;
}

export async function saveAttendanceSheet(input: SaveSheetInput): Promise<AttendanceSheet> {
  const data = await apiRequest<{ sheet: AttendanceSheet }>('PUT', '/teacher/attendance/sheet', {
    body: input,
  });

  return data.sheet;
}
