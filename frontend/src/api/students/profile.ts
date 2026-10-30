import { apiRequest } from '../apiClient';

import type { GroupSession } from './groups';
import type { PaymentStatus } from './students';

// One student's profile.
//
// Backend endpoints (backend/src/modules/students/profile):
//
//   GET  /teacher/students/:studentId              -> 200 { profile: StudentProfile }
//   GET  /teacher/students/:studentId/attendance   -> 200 { attendance: AttendanceRecord[] }
//   GET  /teacher/students/:studentId/exams        -> 200 { exams: ExamResult[] }
//   GET  /teacher/students/:studentId/payments     -> 200 { payments: PaymentMonth[] }
//   GET  /teacher/students/:studentId/notes        -> 200 { notes: TeacherNote[] }
//   POST /teacher/students/:studentId/notes        -> 201 { note: TeacherNote }
//
// Error codes (read them from ApiError.code):
//
//   STUDENT_NOT_FOUND   404  no student with this id for this teacher
//   INVALID_INPUT       400  the note failed validation
//
// Conventions: ids are strings, dates ISO strings, a month is "YYYY-MM",
// money is whole Egyptian pounds, lists are newest first, and null means
// "no data yet" (never the same as 0).

/* ---------------------------------- Types --------------------------------- */

export type StudentProfile = {
  id: string;
  code: string;
  name: string;
  grade: { id: string; name: string };
  // Every student is in exactly one group (its attendance sheet).
  group: { id: string; name: string; sessions: GroupSession[] };
  // Stored normalized: "01012345678".
  parentPhone: string;
  phone: string | null;
  joinedAt: string;
  // The grade's monthly fee, or null when the grade uses the default.
  monthlyFee: number | null;
  summary: StudentSummary;
};

// The four tiles. Computed by the server from the same records as the
// lists (never stored), so they can't disagree with the tabs.
export type StudentSummary = {
  attendance: {
    // % of the group's sessions attended, 0-100. null: no sessions yet.
    rate: number | null;
    attended: number;
    total: number;
  };
  marks: {
    // Average of all exam percentages, 0-100. null: no exams yet.
    average: number | null;
    examCount: number;
    // Points up or down since last month's average. null: not enough data.
    changeSinceLastMonth: number | null;
  };
  // This month's row of the payments list.
  currentFee: PaymentMonth | null;
  // The most recent session of their group. null: none held yet.
  lastSession: AttendanceRecord | null;
};

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

// One session, from this student's point of view.
export type AttendanceRecord = {
  sessionId: string;
  heldAt: string;
  status: AttendanceStatus;
  groupName: string;
  // true: they came to another group's session of the same grade.
  isMakeUp: boolean;
  // Why they were absent or excused, when the teacher wrote it down.
  reason: string | null;
};

// The exams page's words: absent (they missed it) is not the same as
// not-entered (held, but no mark saved yet).
export type ExamResultStatus = 'scored' | 'absent' | 'not-entered';

// An exam the student is on. Upcoming ones are left out until they have a result.
export type ExamResult = {
  examId: string;
  title: string;
  kind: 'quiz' | 'exam';
  heldAt: string;
  status: ExamResultStatus;
  // null unless status is 'scored' (not the same as scoring 0).
  score: number | null;
  maxScore: number;
};

// One month's fee, by the payments page's rules (discount, skips, voids).
// Every month from joining to now, plus any month paid ahead.
export type PaymentMonth = {
  month: string;
  amountDue: number;
  amountPaid: number;
  status: PaymentStatus;
  // Why the month was skipped. null unless status is 'skipped'.
  skipReason: string | null;
  // The day of the latest payment for this month. null: nothing paid.
  lastPaidAt: string | null;
};

// Private to the teacher. Never part of anything a parent can open.
export type TeacherNote = {
  id: string;
  text: string;
  createdAt: string;
};

/* -------------------------------- Requests -------------------------------- */

const studentPath = (studentId: string) => `/teacher/students/${encodeURIComponent(studentId)}`;

export async function getStudentProfile(
  studentId: string,
  signal?: AbortSignal
): Promise<StudentProfile> {
  const data = await apiRequest<{ profile: StudentProfile }>('GET', studentPath(studentId), {
    signal,
  });

  return data.profile;
}

export async function getStudentAttendance(
  studentId: string,
  signal?: AbortSignal
): Promise<AttendanceRecord[]> {
  const data = await apiRequest<{ attendance: AttendanceRecord[] }>(
    'GET',
    `${studentPath(studentId)}/attendance`,
    { signal }
  );

  return data.attendance;
}

export async function getStudentExams(
  studentId: string,
  signal?: AbortSignal
): Promise<ExamResult[]> {
  const data = await apiRequest<{ exams: ExamResult[] }>('GET', `${studentPath(studentId)}/exams`, {
    signal,
  });

  return data.exams;
}

export async function getStudentPayments(
  studentId: string,
  signal?: AbortSignal
): Promise<PaymentMonth[]> {
  const data = await apiRequest<{ payments: PaymentMonth[] }>(
    'GET',
    `${studentPath(studentId)}/payments`,
    { signal }
  );

  return data.payments;
}

export async function getStudentNotes(
  studentId: string,
  signal?: AbortSignal
): Promise<TeacherNote[]> {
  const data = await apiRequest<{ notes: TeacherNote[] }>(
    'GET',
    `${studentPath(studentId)}/notes`,
    {
      signal,
    }
  );

  return data.notes;
}

export async function createStudentNote(studentId: string, text: string): Promise<TeacherNote> {
  const data = await apiRequest<{ note: TeacherNote }>('POST', `${studentPath(studentId)}/notes`, {
    body: { text },
  });

  return data.note;
}
