import { currentMonthInCairo, todayInCairo } from '../../../utils/cairoDate';
import { toAttendanceRate } from '../../attendance/attendance.rules';
import { findSchedulesByGroups } from '../../groups/groups.repository';
import { toSessions } from '../../groups/groups.service';
import { StudentErrors } from '../students.errors';
import type { PaymentStatus } from '../students.service';

import {
  countAttendance,
  findAttendanceRecords,
  findNotes,
  findStudentExams,
  findStudentMarkAverage,
  findStudentPaymentMonths,
  findStudentProfile,
  insertNote,
  studentExists,
  type AttendanceRow,
  type MarkAverageRow,
  type NoteRow,
  type StudentExamRow,
  type StudentMonthRow,
} from './students.profile.repository';
import type { NoteInput } from './students.profile.validation';

// One student's profile: the header and summary, and the lists behind the
// tabs. Built on what exists today:
//
//   - the student, grade and group     (students, grades, groups)
//   - attendance                       (class_sessions, attendance_records)
//   - marks                            (exams, exam_results)
//   - fees                             (payments, student_months)
//   - notes                            (student_notes)
//
// Marks and fees reuse the exams and payments modules' own SQL (who is on an
// exam, what is due and paid), so the profile can't disagree with those pages.
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

// not-entered: the exam was held but no mark is saved yet (not "missed").
export type ExamResultStatus = 'scored' | 'absent' | 'not-entered';

export type ExamResult = {
  examId: string;
  title: string;
  kind: 'quiz' | 'exam';
  heldAt: string;
  status: ExamResultStatus;
  score: number | null;
  maxScore: number;
};

export type PaymentMonth = {
  month: string;
  amountDue: number;
  amountPaid: number;
  status: PaymentStatus;
  // Why the month was skipped, when it was.
  skipReason: string | null;
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

function toExamResult(row: StudentExamRow): ExamResult {
  return {
    examId: row.exam_id,
    title: row.title,
    kind: row.kind,
    heldAt: row.held_at.toISOString(),
    status: row.status ?? 'not-entered',
    score: row.score,
    maxScore: row.max_mark,
  };
}

function toPaymentMonth(row: StudentMonthRow): PaymentMonth {
  return {
    month: row.month,
    amountDue: row.due,
    amountPaid: row.paid,
    status: row.status,
    skipReason: row.skip_reason,
    lastPaidAt: row.last_paid_at?.toISOString() ?? null,
  };
}

// Whole percents. The change is worked out from the unrounded averages, and
// only when both months have marks: one empty month says nothing.
function toMarksSummary(row: MarkAverageRow): StudentProfile['summary']['marks'] {
  const bothMonths = row.this_month !== null && row.last_month !== null;

  return {
    average: row.average === null ? null : Math.round(row.average),
    examCount: row.exam_count,
    changeSinceLastMonth: bothMonths ? Math.round(row.this_month! - row.last_month!) : null,
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
// The student first (it is also the ownership check), then the rest at the
// same time: they don't depend on each other.
export async function getStudentProfile(
  teacherId: string,
  studentId: string
): Promise<StudentProfile> {
  const row = await findStudentProfile(teacherId, studentId);

  if (!row) throw StudentErrors.notFound();

  const month = currentMonthInCairo();
  const [counts, [lastSession], slots, marks, months] = await Promise.all([
    countAttendance(studentId),
    findAttendanceRecords(studentId, 1),
    findSchedulesByGroups(teacherId, [row.group_id]),
    findStudentMarkAverage(studentId, month),
    findStudentPaymentMonths(studentId, month),
  ]);
  // From joining to now, so this month is always in the list.
  const thisMonth = months.find((entry) => entry.month === month);

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    grade: { id: row.grade_id, name: row.grade_name },
    group: { id: row.group_id, name: row.group_name, sessions: toSessions(slots) },
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
      marks: toMarksSummary(marks),
      currentFee: thisMonth ? toPaymentMonth(thisMonth) : null,
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
export async function listStudentExams(
  teacherId: string,
  studentId: string
): Promise<ExamResult[]> {
  await assertStudentExists(teacherId, studentId);

  const rows = await findStudentExams(studentId, todayInCairo());

  return rows.map(toExamResult);
}

// GET /teacher/students/:studentId/payments
export async function listStudentPayments(
  teacherId: string,
  studentId: string
): Promise<PaymentMonth[]> {
  await assertStudentExists(teacherId, studentId);

  const rows = await findStudentPaymentMonths(studentId, currentMonthInCairo());

  return rows.map(toPaymentMonth);
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
