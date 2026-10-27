import { todayInCairo } from '../../utils/cairoDate';

import { GroupErrors } from '../groups/groups.errors';

import { AttendanceErrors } from './attendance.errors';
import {
  findFirstGroupId,
  findGradeGroupOptions,
  findGroupWithGrade,
  findMostRecentGroupId,
  findScheduledClassesOn,
  findSession,
  findSheetStudents,
  saveSheet,
} from './attendance.repository';
import { statusTakesReason, type AttendanceStatus } from './attendance.rules';
import type { SaveSheetInput, SheetQuery } from './attendance.validation';

// Taking attendance: which class (the pickers and the default), the sheet
// itself, and saving it.
//
// The types are the API's answer, and must match the frontend's
// (frontend/src/api/attendance/attendance.ts) field for field.

/* ---------------------------------- Types --------------------------------- */

export type AttendanceGradeOption = {
  id: string;
  name: string;
  groups: { id: string; name: string }[];
};

export type SheetStudent = {
  id: string;
  code: string;
  name: string;
  isMakeUp: boolean;
  groupName: string;
  status: AttendanceStatus | null;
  reason: string | null;
};

export type AttendanceSheet = {
  grade: { id: string; name: string };
  group: { id: string; name: string };
  date: string;
  session: { id: string; createdAt: string; editedAt: string | null } | null;
  students: SheetStudent[];
};

/* --------------------------------- Helpers -------------------------------- */

// Attendance records what happened: a day that hasn't come yet is refused.
// Compared as "YYYY-MM-DD" strings, which sort like the dates they are.
function assertNotFuture(day: string): void {
  if (day > todayInCairo()) throw AttendanceErrors.dateInFuture();
}

/* -------------------------------- Functions ------------------------------- */

// GET /teacher/attendance/options
//
// One row per group from the database, folded into grades -> groups here.
// The rows arrive already ordered, so a Map keeps that order.
export async function getAttendanceOptions(teacherId: string): Promise<AttendanceGradeOption[]> {
  const rows = await findGradeGroupOptions(teacherId);
  const grades = new Map<string, AttendanceGradeOption>();

  for (const row of rows) {
    const grade = grades.get(row.grade_id) ?? {
      id: row.grade_id,
      name: row.grade_name,
      groups: [],
    };

    grade.groups.push({ id: row.group_id, name: row.group_name });
    grades.set(row.grade_id, grade);
  }

  return [...grades.values()];
}

// GET /teacher/attendance/sheet?groupId=&date=
//
// READ ONLY: shows the sheet, never creates a session. Only saving does,
// so browsing groups can't leave empty "classes held" behind.
export async function getAttendanceSheet(
  teacherId: string,
  query: SheetQuery
): Promise<AttendanceSheet> {
  assertNotFuture(query.date);

  // No group asked for: the one taken most recently, else the first one.
  const groupId =
    query.groupId ??
    (await findMostRecentGroupId(teacherId)) ??
    (await findFirstGroupId(teacherId));

  if (!groupId) throw AttendanceErrors.noGroups();

  const group = await findGroupWithGrade(teacherId, groupId);

  if (!group) throw GroupErrors.notFound();

  const session = await findSession(group.group_id, query.date);
  const students = await findSheetStudents(
    teacherId,
    group.group_id,
    session?.id ?? null,
    query.date
  );

  return {
    grade: { id: group.grade_id, name: group.grade_name },
    group: { id: group.group_id, name: group.group_name },
    date: query.date,
    session: session
      ? {
          id: session.id,
          createdAt: session.created_at.toISOString(),
          editedAt: session.edited_at?.toISOString() ?? null,
        }
      : null,
    students: students.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      isMakeUp: row.is_make_up,
      groupName: row.group_name,
      status: row.status,
      reason: row.reason,
    })),
  };
}

// PUT /teacher/attendance/sheet
//
// Finds or creates the group's session for that day and saves every mark,
// then answers with the sheet as it now is (so the screen shows exactly
// what was stored). Sending the same sheet twice changes nothing more.
export async function saveAttendanceSheet(
  teacherId: string,
  input: SaveSheetInput
): Promise<AttendanceSheet> {
  assertNotFuture(input.date);

  const group = await findGroupWithGrade(teacherId, input.groupId);

  if (!group) throw GroupErrors.notFound();

  const result = await saveSheet(
    teacherId,
    { gradeId: group.grade_id, groupId: group.group_id },
    input.date,
    input.records.map((record) => ({
      studentId: record.studentId,
      status: record.status,
      // A reason only belongs to absent or excused; drop it otherwise.
      reason: statusTakesReason(record.status) ? record.reason : null,
    }))
  );

  if (result.status === 'student-not-found') throw AttendanceErrors.studentNotFound();

  return getAttendanceSheet(teacherId, { groupId: group.group_id, date: input.date });
}

/* ------------------------------ Today's classes ---------------------------- */

export type ScheduledClass = {
  groupId: string;
  groupName: string;
  gradeId: string;
  gradeName: string;
  startTime: string;
  // Attendance has been taken for this class today.
  taken: boolean;
};

// The timetable's classes for today in Egypt, earliest first.
export async function getClassesToday(
  teacherId: string
): Promise<{ date: string; classes: ScheduledClass[] }> {
  const date = todayInCairo();
  const classes = await findScheduledClassesOn(teacherId, date);

  return { date, classes };
}
