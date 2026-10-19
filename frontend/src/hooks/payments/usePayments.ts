import { useCallback, useEffect, useState } from 'react';

import { ApiError, isAbortError } from '../../api/apiClient';
import {
  getGradePayments,
  getPaymentsOverview,
  recordPayment,
  saveMonthNote,
  skipMonth,
  unskipMonth,
  voidPayment,
  type GradePayments,
  type IsoMonth,
  type PaymentsOverview,
  type RecordPaymentInput,
} from '../../api/payments/payments';

// The payments pages read and write ONLY through these hooks: loading,
// errors and "what's on screen after a save" live here, not in the pages.
//
// Both use the same pattern as useExam: "loading" is DERIVED. Each answer
// is tagged with the request it belongs to (month, grade, reload count); an
// answer for an older request simply doesn't count. So there's no setState
// inside an effect, and switching months never flashes the previous one.

export type OverviewState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; overview: PaymentsOverview };

export type GradePaymentsState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; data: GradePayments };

/* -------------------------------- Overview -------------------------------- */

type OverviewResult = { key: string } & (
  { status: 'error'; error: unknown } | { status: 'ready'; overview: PaymentsOverview }
);

// GET /teacher/payments/overview?month=
export function usePaymentsOverview(month: IsoMonth): {
  state: OverviewState;
  reload: () => void;
} {
  const [reloadCount, setReloadCount] = useState(0);
  const requestKey = `${month}:${reloadCount}`;
  const [result, setResult] = useState<OverviewResult | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getPaymentsOverview(month, controller.signal)
      .then((overview) => setResult({ key: requestKey, status: 'ready', overview }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        console.error(error);
        setResult({ key: requestKey, status: 'error', error });
      });

    return () => controller.abort();
  }, [month, requestKey]);

  const state: OverviewState =
    result === null || result.key !== requestKey ? { status: 'loading' } : result;

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  return { state, reload };
}

/* -------------------------------- One grade ------------------------------- */

// Each write answers with the fresh grade, which replaces what's on screen.
// They throw (ApiError) if the server refuses, so the dialogs can say why.
type GradeWrites = {
  record: (input: RecordPaymentInput) => Promise<void>;
  voidPayment: (paymentId: string, reason: string) => Promise<void>;
  skipMonth: (studentId: string, month: IsoMonth, reason: string) => Promise<void>;
  unskipMonth: (studentId: string, month: IsoMonth) => Promise<void>;
  saveNote: (studentId: string, month: IsoMonth, text: string) => Promise<void>;
};

type GradeResult = { key: string } & (
  | { status: 'not-found' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; data: GradePayments }
);

// GET /teacher/payments/grades/:gradeId?month=, and the writes.
// gradeId null: nothing to load (the Record dialog before a grade is
// picked); it stays "loading" and makes no request.
export function useGradePayments(
  gradeId: string | null,
  month: IsoMonth
): { state: GradePaymentsState; reload: () => void } & GradeWrites {
  const [reloadCount, setReloadCount] = useState(0);
  const requestKey = `${gradeId}:${month}:${reloadCount}`;
  const [result, setResult] = useState<GradeResult | null>(null);

  useEffect(() => {
    if (gradeId === null) return;

    const controller = new AbortController();

    getGradePayments(gradeId, month, controller.signal)
      .then((data) => setResult({ key: requestKey, status: 'ready', data }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        // 404: deleted, another teacher's, or a mistyped link. Same answer.
        if (error instanceof ApiError && error.status === 404) {
          setResult({ key: requestKey, status: 'not-found' });
          return;
        }
        console.error(error);
        setResult({ key: requestKey, status: 'error', error });
      });

    return () => controller.abort();
  }, [gradeId, month, requestKey]);

  const state: GradePaymentsState =
    result === null || result.key !== requestKey ? { status: 'loading' } : result;

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  // Puts the server's answer on screen, as the answer to the current request.
  const show = useCallback(
    (data: GradePayments) => setResult({ key: requestKey, status: 'ready', data }),
    [requestKey]
  );

  const writes: GradeWrites = {
    // POST /teacher/payments
    record: useCallback(
      async (input: RecordPaymentInput) => show(await recordPayment(input, month)),
      [show, month]
    ),
    // POST /teacher/payments/:paymentId/void
    voidPayment: useCallback(
      async (paymentId: string, reason: string) =>
        show(await voidPayment(paymentId, reason, month)),
      [show, month]
    ),
    // PUT /teacher/payments/students/:studentId/months/:month/skip
    skipMonth: useCallback(
      async (studentId: string, skipped: IsoMonth, reason: string) =>
        show(await skipMonth(studentId, skipped, reason, month)),
      [show, month]
    ),
    // DELETE /teacher/payments/students/:studentId/months/:month/skip
    unskipMonth: useCallback(
      async (studentId: string, skipped: IsoMonth) =>
        show(await unskipMonth(studentId, skipped, month)),
      [show, month]
    ),
    // PUT /teacher/payments/students/:studentId/months/:month/note
    saveNote: useCallback(
      async (studentId: string, noted: IsoMonth, text: string) =>
        show(await saveMonthNote(studentId, noted, text, month)),
      [show, month]
    ),
  };

  return { state, reload, ...writes };
}
