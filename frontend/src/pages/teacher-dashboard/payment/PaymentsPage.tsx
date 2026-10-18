import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import PaymentsIcon from '../../../components/icons/PaymentsIcon';
import PlusIcon from '../../../components/icons/PlusIcon';
import { primaryButtonClasses } from '../../../components/formStyles';

import { AtAGlance, EarlierOwedBanner, LatestPayments } from './components/OverviewSections';
import GradeView from './components/GradeView';
import MonthSwitcher from './components/MonthSwitcher';
import RecordPaymentDialog from './components/RecordPaymentDialog';
import { overviewFor, usePaymentsSample } from './sample/samplePaymentsStore';
import { currentMonth, isValidMonth, type IsoMonth } from './paymentsHelpers';

/* ---------------------------------- Types --------------------------------- */
// These move to api/payments/payments.ts when the API is built. They are
// written as the server will send them, so the components won't change then.

export type PaymentMethod = 'cash' | 'instapay' | 'vodafone-cash';

// GET /teacher/payments/overview?month=2026-10&gradeId=1 (planned).
// Every number is worked out by the server from the payments, the fee
// history, discounts and waivers: nothing here is stored as a total.
export type PaymentsOverview = {
  month: IsoMonth;
  // false until the teacher has recorded their first payment ever: the
  // page then explains itself instead of showing a wall of zeros.
  hasAnyPayment: boolean;
  totals: {
    expected: number;
    collected: number;
    owed: number;
    students: { paid: number; partly: number; unpaid: number; skipped: number };
  };
  // Money still owed from months BEFORE this one, or null when none.
  earlierOwed: { students: number; amount: number; gradeId: string | null } | null;
  grades: {
    id: string;
    name: string;
    monthlyFee: number | null;
    studentCount: number;
    expected: number;
    collected: number;
    owed: number;
  }[];
  latest: {
    id: string;
    paidOn: string; // "YYYY-MM-DD"
    student: { id: string; name: string };
    grade: { id: string; name: string };
    months: IsoMonth[];
    method: PaymentMethod;
    amount: number;
  }[];
};

/* ---------------------------------- Page ---------------------------------- */

// /teacher/payments?month=2026-10&grade=1
//
// The payments "home", for one month:
//   All grades  -> the month at a glance and the latest payments
//   one grade   -> that grade's students, month by month (GradeView)
//
// The month and the grade live in the URL, like every filter in the app:
// refresh, Back and a shared link all keep them.
function PaymentsPage() {
  // TEMPORARY: the sample store stands in for the API, so the page can be
  // clicked through. This becomes usePaymentsOverview(month, gradeId) and
  // useGrades(); nothing in the JSX below has to change.
  const sample = usePaymentsSample();
  const grades = sample.state.grades;

  const [searchParams, setSearchParams] = useSearchParams();

  const thisMonth = currentMonth();
  const monthParam = searchParams.get('month');
  // A missing, malformed or future month falls back to this month.
  const month = isValidMonth(monthParam) && monthParam <= thisMonth ? monthParam : thisMonth;

  const gradeParam = searchParams.get('grade');
  const gradeId = grades.some((grade) => grade.id === gradeParam) ? gradeParam : null;

  // ?record=1 opens the dialog, so any link (the navbar's "Record payment")
  // can open it. Same pattern as the exams page's ?new=1.
  const isRecording = searchParams.get('record') === '1' && grades.length > 0;
  // Who the dialog starts with, when opened from a student's month.
  const [prefill, setPrefill] = useState<{ studentId: string; month: IsoMonth } | null>(null);

  const overview = useMemo<PaymentsOverview>(
    () => overviewFor(sample.state, month, gradeId),
    [sample.state, month, gradeId]
  );

  const updateParams = (key: 'month' | 'grade' | 'record', value: string | null) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      // replace: browsing months shouldn't fill the Back history.
      { replace: true }
    );
  };

  // This month needs no ?month= in the URL: the clean link is the default.
  const goToMonth = (next: IsoMonth) => updateParams('month', next === thisMonth ? null : next);
  const openRecord = (from?: { studentId: string; month: IsoMonth }) => {
    setPrefill(from ?? null);
    updateParams('record', '1');
  };
  const closeRecord = () => {
    setPrefill(null);
    updateParams('record', null);
  };

  const hasGrades = grades.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Payments</h1>
          <p className="text-sm text-ink-secondary">
            What each month should bring in, what came in, and who still owes.
          </p>
        </div>

        {/* Only once there's something to look at: with nothing recorded,
            the empty state's own button is the one next step. */}
        {overview.hasAnyPayment && (
          <div className="flex flex-wrap items-center gap-2.5">
            <MonthSwitcher
              month={month}
              canGoForward={month < thisMonth}
              onChange={goToMonth}
            />
            <button
              type="button"
              onClick={() => openRecord()}
              className={`${primaryButtonClasses} flex items-center gap-2`}
            >
              <PlusIcon className="h-[18px] w-[18px]" />
              Record payment
            </button>
          </div>
        )}
      </header>

      {!overview.hasAnyPayment ? (
        <PaymentsEmptyState
          hasGrades={hasGrades}
          onRecord={() => openRecord()}
        />
      ) : (
        <>
          {grades.length > 1 && (
            <div
              role="group"
              aria-label="Show by grade"
              className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
            >
              {[{ id: null, name: 'All grades' }, ...grades].map((grade) => {
                const selected = grade.id === gradeId;

                return (
                  <button
                    key={grade.id ?? 'all'}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => updateParams('grade', grade.id)}
                    className={`
                      h-11 shrink-0 rounded-[10px] border px-4 text-sm
                      cursor-pointer transition-colors
                      focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
                      ${
                        selected
                          ? 'border-primary bg-primary-tint font-bold text-primary'
                          : 'border-border bg-surface font-semibold text-ink hover:bg-surface-hover'
                      }
                    `}
                  >
                    {grade.name}
                  </button>
                );
              })}
            </div>
          )}

          {gradeId ? (
            // key: switching grades starts the view fresh (no dialog left open).
            <GradeView
              key={gradeId}
              gradeId={gradeId}
              month={month}
              onRecord={openRecord}
            />
          ) : (
            // Cards first (a column on laptops, a row above on tablets),
            // then the latest payments.
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
              <AtAGlance overview={overview} />

              <div className="flex min-w-0 flex-1 flex-col gap-6">
                {overview.earlierOwed && <EarlierOwedBanner earlier={overview.earlierOwed} />}
                <LatestPayments payments={overview.latest} />
              </div>
            </div>
          )}
        </>
      )}

      {isRecording && (
        <RecordPaymentDialog
          grades={grades}
          defaultGradeId={gradeId}
          {...(prefill ? { initial: prefill } : {})}
          onSubmit={sample.recordPayment}
          onClose={closeRecord}
        />
      )}
    </div>
  );
}

/* ------------------------------- Empty state ------------------------------ */

// Two "empty"s with different next steps, like the exams page:
//   no grades       -> fees belong to grades, so Students first
//   nothing paid yet -> record the first payment, and say what will appear
function PaymentsEmptyState({ hasGrades, onRecord }: { hasGrades: boolean; onRecord: () => void }) {
  return (
    <section className="flex flex-col items-center rounded-2xl border border-border bg-surface px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-tint text-primary">
        <PaymentsIcon className="h-6 w-6" />
      </span>

      {hasGrades ? (
        <>
          <h2 className="mt-4 text-lg font-bold text-ink">No payments recorded yet</h2>
          <p className="mt-1.5 max-w-md text-sm text-ink-secondary">
            Record what students pay each month. You’ll see what came in, what’s still owed and who
            hasn’t paid, for every grade.
          </p>
          <button
            type="button"
            onClick={onRecord}
            className={`${primaryButtonClasses} mt-5 flex items-center gap-2`}
          >
            <PlusIcon className="h-[18px] w-[18px]" />
            Record your first payment
          </button>
        </>
      ) : (
        <>
          <h2 className="mt-4 text-lg font-bold text-ink">Add a grade first</h2>
          <p className="mt-1.5 max-w-md text-sm text-ink-secondary">
            Fees are set per grade. Create a grade with its monthly fee and add its students, then
            come back here.
          </p>
          <Link
            to="/teacher/students"
            className={`${primaryButtonClasses} mt-5 flex items-center`}
          >
            Go to Students
          </Link>
        </>
      )}
    </section>
  );
}

export default PaymentsPage;
