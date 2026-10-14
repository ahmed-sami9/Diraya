import { toAttendanceRate } from '../../attendance/attendance.rules';
import { StudentErrors } from '../students.errors';
import type { PaymentStatus } from '../students.service';

import {
  countAttendance,
  findAttendanceRecords,
  findNotes,
  findStudentProfile,
  insertNote,
  studentExists,
  type AttendanceRow,
  type NoteRow,
} from './students.profile.repository';
import type { NoteInput } from './students.profile.validation';

// One student's profile: the header and summary, and the lists behind the
// tabs. Built on what exists today:
//
//   - the student, grade and group     (students, grades, groups)
//   - attendance                       (class_sessions, attendance_records)
//   - notes                            (student_notes)
//
// Exams and payments have no tables yet. Their lists are empty and their
// summary numbers are null ("no data yet"), which is the truth: none have
// been recorded. When those features are built, only their functions here
// change; the API's shape stays the same.
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

/* -------------------------------- Mapping --------------------------------- */

// Database rows (snake_case) -> API shape (camelCase).

function toAttendanceRecord(row: AttendanceRow): AttendanceRecord {
  return {
    sessionId: row.session_id,
    heldAt: row.held_at.toISOString(),
    status: row.status,
    groupName: row.group_name,
    isMakeUp: row.is_make_up,
    reason: row.reason,
  };
}

function toTeacherNote(row: NoteRow): TeacherNote {
  return { id: row.id, text: row.text, createdAt: row.created_at.toISOString() };
}

// Every list route checks ownership first. Without it, another teacher's
// student id would answer "[]" (an empty list) instead of 404, quietly
// confirming nothing but also hiding a wrong link.
async function assertStudentExists(teacherId: string, studentId: string): Promise<void> {
  if (!(await studentExists(teacherId, studentId))) throw StudentErrors.notFound();
}

/* -------------------------------- Functions ------------------------------- */

// GET /teacher/students/:studentId
//
// The student first (it is also the ownership check), then the two
// attendance reads at the same time: they don't depend on each other.
export async function getStudentProfile(
  teacherId: string,
  studentId: string
): Promise<StudentProfile> {
  const row = await findStudentProfile(teacherId, studentId);

  if (!row) throw StudentErrors.notFound();

  const [counts, [lastSession]] = await Promise.all([
    countAttendance(studentId),
    findAttendanceRecords(studentId, 1),
  ]);

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    grade: { id: row.grade_id, name: row.grade_name },
    // The weekly schedule isn't stored yet (same as the grade page).
    group: { id: row.group_id, name: row.group_name, sessions: [] },
    // Stored nullable for students added before the column existed.
    parentPhone: row.parent_phone ?? '',
    phone: row.phone,
    joinedAt: row.joined_at.toISOString(),
    monthlyFee: row.monthly_fee,
    summary: {
      attendance: {
        // null, not 0, when there is nothing to count yet.
        rate: toAttendanceRate(counts.attended, counts.total),
        attended: counts.attended,
        total: counts.total,
      },
      // No exams table yet.
      marks: { average: null, examCount: 0, changeSinceLastMonth: null },
      // No payments table yet.
      currentFee: null,
      lastSession: lastSession ? toAttendanceRecord(lastSession) : null,
    },
  };
}

// GET /teacher/students/:studentId/attendance
export async function listStudentAttendance(
  teacherId: string,
  studentId: string
): Promise<AttendanceRecord[]> {
  await assertStudentExists(teacherId, studentId);

  const rows = await findAttendanceRecords(studentId, null);

  return rows.map(toAttendanceRecord);
}

// GET /teacher/students/:studentId/exams
//
// No exams table yet: no exam has ever been recorded, so the list is empty.
// Becomes a real query with the exams feature.
export async function listStudentExams(
  teacherId: string,
  studentId: string
): Promise<ExamResult[]> {
  await assertStudentExists(teacherId, studentId);

  return [];
}

// GET /teacher/students/:studentId/payments
//
// No payments table yet: nothing has been paid or charged, so the list is
// empty. Becomes a real query with the payments feature.
export async function listStudentPayments(
  teacherId: string,
  studentId: string
): Promise<PaymentMonth[]> {
  await assertStudentExists(teacherId, studentId);

  return [];
}

// GET /teacher/students/:studentId/notes
//
// Private to the teacher: this and addStudentNote are the ONLY functions
// that touch student_notes. The parent report must never call them.
export async function listStudentNotes(
  teacherId: string,
  studentId: string
): Promise<TeacherNote[]> {
  await assertStudentExists(teacherId, studentId);

  const rows = await findNotes(studentId);

  return rows.map(toTeacherNote);
}

// POST /teacher/students/:studentId/notes
//
// The INSERT itself checks ownership (INSERT ... SELECT), so there is no
// separate check: no gap between "is it theirs?" and "save it".
export async function addStudentNote(
  teacherId: string,
  studentId: string,
  input: NoteInput
): Promise<TeacherNote> {
  const row = await insertNote(teacherId, studentId, input.text);

  if (!row) throw StudentErrors.notFound();

  return toTeacherNote(row);
}
