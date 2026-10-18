import { useCallback } from 'react';

import type {
  GradePayments,
  IsoMonth,
  PaymentsOverview,
  RecordPaymentInput,
} from '../../api/payments/payments';

// The payments pages read and write ONLY through these hooks.
//
// NOT CONNECTED YET: the request functions in api/payments don't exist, so
//   - the overview answers "no payments yet" (the page shows its empty state)
//   - a grade answers with an error that says so
//   - every write refuses with the same message, which the dialogs show
//
// Connecting = replacing the bodies below with real requests (the same
// shape as useExam: derived loading, AbortController, reload). The pages
// and dialogs don't change.

const NOT_CONNECTED = 'Payments aren’t connected to the server yet.';

const notConnected = () => Promise.reject(new Error(NOT_CONNECTED));

export type OverviewState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; overview: PaymentsOverview };

export type GradePaymentsState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; data: GradePayments };

// What a month looks like before anything is recorded.
const emptyOverview = (month: IsoMonth): PaymentsOverview => ({
  month,
  hasAnyPayment: false,
  totals: {
    expected: 0,
    collected: 0,
    owed: 0,
    students: { paid: 0, partly: 0, unpaid: 0, skipped: 0 },
  },
  earlierOwed: null,
  latest: [],
});

/* -------------------------------- Overview -------------------------------- */

// GET /teacher/payments/overview?month=
// The return types are written out, so the pages handle EVERY state
// (loading, error, ready), not just the one the placeholder returns.
export function usePaymentsOverview(month: IsoMonth): {
  state: OverviewState;
  reload: () => void;
} {
  const state: OverviewState = { status: 'ready', overview: emptyOverview(month) };

  const reload = useCallback(() => {}, []);

  return { state, reload };
}

/* -------------------------------- One grade ------------------------------- */

const notConnectedError = new Error(NOT_CONNECTED);

// The writes' shapes. Each one answers with the fresh grade (GradePayments),
// which replaces what's on screen.
type GradeWrites = {
  // POST /teacher/payments
  record: (input: RecordPaymentInput) => Promise<void>;
  // POST /teacher/payments/:paymentId/void
  voidPayment: (paymentId: string, reason: string) => Promise<void>;
  // PUT /teacher/payments/students/:studentId/months/:month/skip
  skipMonth: (studentId: string, month: IsoMonth, reason: string) => Promise<void>;
  // DELETE /teacher/payments/students/:studentId/months/:month/skip
  unskipMonth: (studentId: string, month: IsoMonth) => Promise<void>;
  // PUT /teacher/payments/students/:studentId/months/:month/note
  saveNote: (studentId: string, month: IsoMonth, text: string) => Promise<void>;
};

// Not connected: every write refuses with the same clear message.
const notConnectedWrites: GradeWrites = {
  record: notConnected,
  voidPayment: notConnected,
  skipMonth: notConnected,
  unskipMonth: notConnected,
  saveNote: notConnected,
};

// GET /teacher/payments/grades/:gradeId?month=, and the writes.
// gradeId null: nothing to load yet (the Record dialog before a grade is
// picked).
export function useGradePayments(
  gradeId: string | null,
  month: IsoMonth
): { state: GradePaymentsState; reload: () => void } & GradeWrites {
  const state: GradePaymentsState =
    gradeId === null ? { status: 'loading' } : { status: 'error', error: notConnectedError };

  void month; // part of the request once connected

  const reload = useCallback(() => {}, []);

  return { state, reload, ...notConnectedWrites };
}
