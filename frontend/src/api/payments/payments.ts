import { apiRequest } from '../apiClient';

// Payments: what each month should bring in, what came in, and who owes.
//
// The shapes the server sends and receives, and one request function per
// endpoint. The pages never call these directly: they go through
// hooks/payments, which keeps loading and errors in one place.
//
// Endpoints (backend/src/modules/payments, not built yet):
//
//   Reads
//   GET  /teacher/payments/overview?month=2026-10           -> PaymentsOverview
//   GET  /teacher/payments/grades/:gradeId?month=2026-10    -> GradePayments
//
//   Writes: each takes ?month= (the month on screen) and answers with the
//   fresh GradePayments of that student's grade, for that month
//   POST   /teacher/payments                                      record a payment
//   POST   /teacher/payments/:paymentId/void                      void one, with a reason
//   PUT    /teacher/payments/students/:studentId/months/:month/skip   skip a month
//   DELETE /teacher/payments/students/:studentId/months/:month/skip   undo the skip
//   PUT    /teacher/payments/students/:studentId/months/:month/note   save the month's note
//
// Error codes the server will send back (read them from ApiError.code):
//
//   INVALID_INPUT           400  a field failed validation
//   GRADE_NOT_FOUND         404  no grade with this id for this teacher
//   STUDENT_NOT_FOUND       404  no student with this id for this teacher
//   PAYMENT_NOT_FOUND       404  no payment with this id for this teacher
//   PAYMENT_ALREADY_VOIDED  409  voiding a payment twice
//   MONTH_HAS_PAYMENTS      409  skipping a month that has payments
//   DUPLICATE_REQUEST       409  the same requestId was already recorded
//
// Conventions: ids are strings, a month is "YYYY-MM", a day "YYYY-MM-DD",
// money is whole Egyptian pounds. Every total is worked out by the server
// from the payments, the fee history, discounts and skipped months: nothing
// summarized is stored.

/* --------------------------------- Basics --------------------------------- */

export type IsoMonth = string; // "2026-10"

export type PaymentMethod = 'cash' | 'instapay' | 'vodafone-cash';

// Where one student stands in one month.
export type MonthStatus = 'paid' | 'partly' | 'unpaid' | 'skipped' | 'not-due';

/* ------------------------------- Overview --------------------------------- */

// GET /teacher/payments/overview?month=
export type PaymentsOverview = {
  month: IsoMonth;
  // false until the teacher's first payment ever: the page then explains
  // itself instead of showing a wall of zeros.
  hasAnyPayment: boolean;
  totals: {
    expected: number;
    collected: number;
    owed: number;
    students: { paid: number; partly: number; unpaid: number; skipped: number };
  };
  // Money still owed from months BEFORE this one, or null when none.
  // gradeId: the grade to open for "See who" (the first one with debt).
  earlierOwed: { students: number; amount: number; gradeId: string | null } | null;
  // This month's payments, newest first. One row per "Record payment",
  // even when it covered several months.
  latest: {
    id: string;
    paidOn: string;
    student: { id: string; name: string };
    grade: { id: string; name: string };
    months: IsoMonth[];
    method: PaymentMethod;
    amount: number;
  }[];
};

/* ------------------------------- One grade -------------------------------- */

export type Payment = {
  id: string;
  amount: number;
  paidOn: string;
  method: PaymentMethod;
  note: string | null;
  // Payments are never deleted, only voided, with why.
  voided: { on: string; reason: string } | null;
};

// One student in one month: what a grid cell and the month dialog show.
export type StudentMonth = {
  month: IsoMonth;
  gradeFee: number;
  discountPercent: number;
  due: number;
  paid: number;
  left: number;
  status: MonthStatus;
  // Why nothing is due: before they joined, or a month that hasn't come.
  notDueReason: 'before-joining' | 'future' | null;
  payments: Payment[]; // voided ones included, newest first
  skipReason: string | null;
  note: string | null;
};

export type PaymentStudent = {
  id: string;
  name: string;
  code: string;
  groupId: string;
  // A standing discount, e.g. 50 for twins. 0 = none.
  discountPercent: number;
  discountReason: string | null;
};

// GET /teacher/payments/grades/:gradeId?month=
// The selected month, three before it and one after (paying ahead).
export type GradePayments = {
  grade: { id: string; name: string; fee: number };
  groups: { id: string; name: string }[];
  month: IsoMonth;
  months: IsoMonth[];
  students: {
    student: PaymentStudent;
    groupName: string;
    cells: StudentMonth[]; // one per `months`
    selected: StudentMonth; // the selected month
    owes: number; // everything still owed up to the selected month
  }[];
  totals: { expected: number; collected: number; owed: number; unpaid: number; partly: number };
};

/* --------------------------------- Inputs --------------------------------- */

// POST /teacher/payments
// The server splits `amount` over `months`, oldest first; the last month
// takes what's left. requestId: made once per dialog, so a double click
// can't record the same payment twice (the server refuses a repeat).
export type RecordPaymentInput = {
  requestId: string;
  studentId: string;
  months: IsoMonth[];
  amount: number;
  paidOn: string;
  method: PaymentMethod;
  note: string | null;
};

/* -------------------------------- Requests -------------------------------- */

const enc = encodeURIComponent;
const studentMonthPath = (studentId: string, month: IsoMonth) =>
  `/teacher/payments/students/${enc(studentId)}/months/${enc(month)}`;

export function getPaymentsOverview(
  month: IsoMonth,
  signal?: AbortSignal
): Promise<PaymentsOverview> {
  return apiRequest<PaymentsOverview>('GET', `/teacher/payments/overview?month=${enc(month)}`, {
    signal,
  });
}

export function getGradePayments(
  gradeId: string,
  month: IsoMonth,
  signal?: AbortSignal
): Promise<GradePayments> {
  return apiRequest<GradePayments>(
    'GET',
    `/teacher/payments/grades/${enc(gradeId)}?month=${enc(month)}`,
    { signal }
  );
}

// The writes all answer with the student's grade as it now is.
// `month` is the month on screen, so the answer covers the same months.

export function recordPayment(input: RecordPaymentInput, month: IsoMonth): Promise<GradePayments> {
  return apiRequest<GradePayments>('POST', `/teacher/payments?month=${enc(month)}`, {
    body: input,
  });
}

export function voidPayment(
  paymentId: string,
  reason: string,
  month: IsoMonth
): Promise<GradePayments> {
  return apiRequest<GradePayments>(
    'POST',
    `/teacher/payments/${enc(paymentId)}/void?month=${enc(month)}`,
    { body: { reason } }
  );
}

export function skipMonth(
  studentId: string,
  skipped: IsoMonth,
  reason: string,
  month: IsoMonth
): Promise<GradePayments> {
  return apiRequest<GradePayments>(
    'PUT',
    `${studentMonthPath(studentId, skipped)}/skip?month=${enc(month)}`,
    { body: { reason } }
  );
}

export function unskipMonth(
  studentId: string,
  skipped: IsoMonth,
  month: IsoMonth
): Promise<GradePayments> {
  return apiRequest<GradePayments>(
    'DELETE',
    `${studentMonthPath(studentId, skipped)}/skip?month=${enc(month)}`
  );
}

// Empty text removes the note.
export function saveMonthNote(
  studentId: string,
  noted: IsoMonth,
  text: string,
  month: IsoMonth
): Promise<GradePayments> {
  return apiRequest<GradePayments>(
    'PUT',
    `${studentMonthPath(studentId, noted)}/note?month=${enc(month)}`,
    { body: { text } }
  );
}
