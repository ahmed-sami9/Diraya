import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { formatMoney, formatMonth, type IsoMonth } from '../paymentsHelpers';
import SectionError from '../../../../components/SectionError';
import { useGradePayments } from '../../../../hooks/payments/usePayments';

import { GradeTiles, MonthGrid, MonthList, StatusLegend } from './GradeSections';
import StudentMonthDialog from './StudentMonthDialog';

interface GradeViewProps {
  gradeId: string;
  month: IsoMonth;
  // Opens the page's Record payment dialog, for a student's month if given.
  onRecord: (prefill?: { studentId: string; month: IsoMonth }) => void;
}

// One grade on the payments page (?grade=g3): its month in numbers, then
// every student month by month: who paid, when, and what's left. Click any
// cell (or row, on a phone) to open that student's month.
//
// The group and "owes money" filters live in the URL (&group=, &owes=1).
// Which cell is open is plain state here: nobody else needs it.
function GradeView({ gradeId, month, onRecord }: GradeViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const payments = useGradePayments(gradeId, month);
  const data = payments.state.status === 'ready' ? payments.state.data : null;

  const groupParam = searchParams.get('group');
  const groupId = data?.groups.some((group) => group.id === groupParam) ? groupParam : null;
  const owesOnly = searchParams.get('owes') === '1';

  const [open, setOpen] = useState<{ studentId: string; month: IsoMonth } | null>(null);

  const updateParams = (key: 'group' | 'owes', value: string | null) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );
  };

  if (payments.state.status === 'error') {
    return (
      <SectionError
        title="We couldn’t load this grade’s payments"
        error={payments.state.error}
        onRetry={payments.reload}
      />
    );
  }

  if (payments.state.status === 'not-found') {
    return (
      <p className="rounded-2xl border border-border bg-surface px-6 py-10 text-center text-sm text-ink-secondary">
        This grade doesn’t exist any more. Pick another one above.
      </p>
    );
  }

  if (!data) {
    return (
      <div
        role="status"
        className="h-[420px] animate-pulse rounded-2xl border border-border bg-surface"
      >
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  // Filters are derived from the URL, never copied into state.
  const rows = data.students.filter(
    (row) => (!groupId || row.student.groupId === groupId) && (!owesOnly || row.owes > 0)
  );

  // The open cell, read from the latest data on every render: after a
  // void or a skip the server's fresh answer replaces `data`, and the dialog
  // shows the new numbers straight away.
  const openRow = open ? data.students.find((row) => row.student.id === open.studentId) : undefined;
  const openInfo = open ? openRow?.cells.find((cell) => cell.month === open.month) : undefined;

  const pill = (selected: boolean) => `
    h-10 shrink-0 cursor-pointer rounded-[10px] border px-3 text-[13px] transition-colors
    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
    ${selected ? 'border-primary bg-primary-tint font-bold text-primary' : 'border-border bg-surface font-semibold text-ink hover:bg-surface-hover'}
  `;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight text-ink">{data.grade.name}</h2>
        <p className="text-sm text-ink-secondary">{formatMoney(data.grade.fee)} / month</p>
      </div>

      <GradeTiles data={data} />

      <section
        aria-labelledby="grade-students-title"
        className="rounded-2xl border border-border bg-surface"
      >
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border-strong px-4 py-3.5 sm:px-5">
          <h2
            id="grade-students-title"
            className="mr-auto text-base font-bold text-ink"
          >
            <span className="hidden md:inline">Month by month</span>
            <span className="md:hidden">{formatMonth(month)}</span>
          </h2>

          {data.groups.length > 1 && (
            <div
              role="group"
              aria-label="Show by group"
              className="flex gap-1.5 overflow-x-auto"
            >
              {[{ id: null, name: 'All' }, ...data.groups].map((group) => (
                <button
                  key={group.id ?? 'all'}
                  type="button"
                  aria-pressed={group.id === groupId}
                  onClick={() => updateParams('group', group.id)}
                  className={pill(group.id === groupId)}
                >
                  {group.name}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            aria-pressed={owesOnly}
            onClick={() => updateParams('owes', owesOnly ? null : '1')}
            className={pill(owesOnly)}
          >
            Owes money
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-secondary">
            {owesOnly ? 'Nobody here owes anything.' : 'No students in this group.'}
          </p>
        ) : (
          <>
            {/* Tablet and up: the grid. Phones: one month as a list. */}
            <div className="hidden md:block">
              <MonthGrid
                data={data}
                rows={rows}
                onOpen={(studentId, m) => setOpen({ studentId, month: m })}
              />
            </div>
            <div className="md:hidden">
              <MonthList
                rows={rows}
                onOpen={(studentId, m) => setOpen({ studentId, month: m })}
              />
            </div>
          </>
        )}

        <div className="border-t border-border-strong">
          <StatusLegend />
        </div>
      </section>

      {open && openRow && openInfo && (
        <StudentMonthDialog
          // A new key per cell: opening another cell starts the dialog fresh.
          key={`${open.studentId}-${open.month}`}
          student={openRow.student}
          gradeName={data.grade.name}
          groupName={openRow.groupName}
          info={openInfo}
          onRecordPayment={() => {
            onRecord(open);
            setOpen(null);
          }}
          onVoid={payments.voidPayment}
          onSkip={(reason) => payments.skipMonth(open.studentId, open.month, reason)}
          onUnskip={() => payments.unskipMonth(open.studentId, open.month)}
          onSaveNote={(text) => payments.saveNote(open.studentId, open.month, text)}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

export default GradeView;
