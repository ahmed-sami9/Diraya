import type { GroupSession } from '../../../../api/students/groups';
import type { PaymentStatus } from '../../../../api/students/students';

// The shapes the student profile renders. They are the CONTRACT for the
// backend: when the API and hooks are built, they return exactly these, and
// no component below has to change.
//
// Conventions (the same as the rest of the API):
//   - ids are strings (Postgres bigint ids don't fit safely in a JS number)
//   - dates and times are ISO strings: "2026-10-07T16:00:00.000Z"
//   - a month is "YYYY-MM": "2026-10"
//   - money is a whole number of Egyptian pounds: 350
//   - null means "no data yet", never 0 ("0% attendance" and "no sessions
//     yet" are different things)

/* ------------------------------ The student ------------------------------ */

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

// The four tiles under the header. Computed by the server from the records
// below (never stored), so they can't disagree with the tabs.
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
    // Points up or down compared with last month's average. null: not enough data.
    changeSinceLastMonth: number | null;
  };
  // This month's fee. null: no fee is set up yet.
  currentFee: PaymentMonth | null;
  // The most recent session of their group. null: none held yet.
  lastSession: AttendanceRecord | null;
};

/* ------------------------------ Attendance ------------------------------- */

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

// One session, from this student's point of view. The server joins
// class_sessions (when, which group) with attendance_records (their status).
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

/* ------------------------------ Exams & marks ---------------------------- */

export type ExamResult = {
  examId: string;
  title: string;
  kind: 'quiz' | 'exam';
  heldAt: string;
  // null: they missed the exam (not the same as scoring 0).
  score: number | null;
  maxScore: number;
};

/* -------------------------------- Payments ------------------------------- */

// One month's fee. Derived from the payments recorded for that month.
export type PaymentMonth = {
  month: string;
  amountDue: number;
  amountPaid: number;
  status: PaymentStatus;
  // When the last payment for this month was recorded. null: nothing paid.
  lastPaidAt: string | null;
};

/* ---------------------------------- Notes -------------------------------- */

// Private to the teacher. Never part of anything a parent can open.
export type TeacherNote = {
  id: string;
  text: string;
  createdAt: string;
};

/* ------------------------- What the page works with ---------------------- */

// Lists are newest first, the order the page shows them.
export type StudentProfileData = {
  profile: StudentProfile;
  attendance: AttendanceRecord[];
  exams: ExamResult[];
  payments: PaymentMonth[];
  notes: TeacherNote[];
};

// The same four states as the grade page.
export type ProfileState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'not-found' }
  | { status: 'ready'; data: StudentProfileData };

// Everything a teacher can DO on the profile. Each will call the API once it
// exists; the components only know these names.
export type ProfileActions = {
  editStudent: () => void;
  shareWithParent: () => void;
  moveToGroup: () => void;
  recordPayment: () => void;
  // Resolves when saved; throws (ApiError) when the server refuses.
  addNote: (text: string) => Promise<void>;
  retry: () => void;
};

// What the layout hands to the tab under it (React Router's outlet context).
export type ProfileOutletContext = {
  data: StudentProfileData;
  actions: ProfileActions;
};
