import { AppError } from '../../../errors/AppError';

import type { PaymentStatus } from '../students.service';

import type { NoteInput } from './students.profile.validation';

// The student profile's logic. NOT BUILT YET: every function below answers
// 501 Not Implemented, so the whole path (frontend request -> route ->
// controller -> here) already works and can be tested end to end.
//
// Each function says what it will do. Building one means replacing its
// `throw` with that, plus its SQL in a students.profile.repository.ts.
//
// The types are the API's answer, and must match the frontend's
// (frontend/src/api/students/profile.ts) field for field.

/* ---------------------------------- Types --------------------------------- */

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

export type AttendanceRecord = {
  sessionId: string;
  heldAt: string;
  status: AttendanceStatus;
  groupName: string;
  isMakeUp: boolean;
  reason: string | null;
};

export type ExamResult = {
  examId: string;
  title: string;
  kind: 'quiz' | 'exam';
  heldAt: string;
  score: number | null;
  maxScore: number;
};

export type PaymentMonth = {
  month: string;
  amountDue: number;
  amountPaid: number;
  status: PaymentStatus;
  lastPaidAt: string | null;
};

export type TeacherNote = {
  id: string;
  text: string;
  createdAt: string;
};

export type StudentProfile = {
  id: string;
  code: string;
  name: string;
  grade: { id: string; name: string };
  group: { id: string; name: string; sessions: { dayOfWeek: number; startTime: string }[] };
  parentPhone: string;
  phone: string | null;
  joinedAt: string;
  monthlyFee: number | null;
  summary: {
    attendance: { rate: number | null; attended: number; total: number };
    marks: { average: number | null; examCount: number; changeSinceLastMonth: number | null };
    currentFee: PaymentMonth | null;
    lastSession: AttendanceRecord | null;
  };
};

/* --------------------------------- Helpers -------------------------------- */

// 501: the route exists, the logic doesn't yet. Not a 404 (the address is
// right) and not a 500 (nothing crashed).
const notBuiltYet = (what: string) =>
  new AppError(501, 'NOT_IMPLEMENTED', `Not built yet: ${what}.`);

/* -------------------------------- Functions ------------------------------- */

// GET /teacher/students/:studentId
//
// Will: one query joining students -> grades -> groups, filtered by
// teacher_id AND id (another teacher's student -> StudentErrors.notFound()).
// The group's sessions come from listGroups' schedule (still [] today).
// The summary comes from the same tables as the lists below (counts and
// averages in SQL), so it can never disagree with them. Until attendance,
// exams and payments have tables, its numbers are null / 0.
export async function getStudentProfile(
  _teacherId: string,
  _studentId: string
): Promise<StudentProfile> {
  throw notBuiltYet('The student profile');
}

// GET /teacher/students/:studentId/attendance
//
// Will: class_sessions JOIN attendance_records for this student, newest
// first. isMakeUp = the session's group is not the student's group.
// Needs the attendance tables first.
export async function listStudentAttendance(
  _teacherId: string,
  _studentId: string
): Promise<AttendanceRecord[]> {
  throw notBuiltYet('Attendance history');
}

// GET /teacher/students/:studentId/exams
//
// Will: exams JOIN exam_results for this student, newest first. A student
// with no result row for an exam of their group gets score: null (missed).
// Needs the exams tables first.
export async function listStudentExams(
  _teacherId: string,
  _studentId: string
): Promise<ExamResult[]> {
  throw notBuiltYet('Exam results');
}

// GET /teacher/students/:studentId/payments
//
// Will: one row per month since the student joined: amountDue from the
// grade's fee, amountPaid = SUM of that month's payments, status derived
// from the two. Newest month first. Needs the payments table first.
export async function listStudentPayments(
  _teacherId: string,
  _studentId: string
): Promise<PaymentMonth[]> {
  throw notBuiltYet('Payments');
}

// GET /teacher/students/:studentId/notes
//
// Will: student_notes for this student, newest first. Private to the
// teacher: this is the ONLY route that ever selects them (never the parent
// report's).
export async function listStudentNotes(
  _teacherId: string,
  _studentId: string
): Promise<TeacherNote[]> {
  throw notBuiltYet('Notes');
}

// POST /teacher/students/:studentId/notes
//
// Will: INSERT ... SELECT from students WHERE id AND teacher_id (the same
// ownership check as insertGroup), RETURNING the new note. No row ->
// StudentErrors.notFound().
export async function addStudentNote(
  _teacherId: string,
  _studentId: string,
  _input: NoteInput
): Promise<TeacherNote> {
  throw notBuiltYet('Adding notes');
}
