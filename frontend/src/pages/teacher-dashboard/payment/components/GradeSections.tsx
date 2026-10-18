import {
  STATUS_STYLE,
  currentMonth,
  formatMoney,
  monthName,
  type IsoMonth,
  type MonthStatus,
} from '../paymentsHelpers';
import type { GradePayments, StudentMonth } from '../sample/samplePaymentsStore';

// The sections of one grade's payments page: the month's tiles, the
// students × months grid (tablet and up), and the one-month list (phones).

// What a cell says: the main line and a small one under it.
function cellText(info: StudentMonth): { top: string; bottom: string } {
  switch (info.status) {
    case 'paid':
      return { top: '✓', bottom: info.month > currentMonth() ? 'paid ahead' : `${info.due}` };
    case 'partly':
      return { top: `${info.paid}`, bottom: `of ${info.due}` };
    case 'unpaid':
      return { top: '✗', bottom: `${info.due} due` };
    case 'skipped':
      return { top: 'Skipped', bottom: '' };
    case 'not-due':
      return { top: '—', bottom: info.notDueReason === 'before-joining' ? 'not joined' : '' };
  }
}

const cellLabel = (name: string, info: StudentMonth) =>
  `${name}, ${monthName(info.month)}: ${STATUS_STYLE[info.status].label}` +
  (info.status === 'partly' || info.status === 'unpaid' ? `, ${formatMoney(info.left)} left` : '');

/* ---------------------------------- Tiles --------------------------------- */

export function GradeTiles({ data }: { data: GradePayments }) {
  const { totals } = data;
  const percent =
    totals.expected === 0 ? 100 : Math.round((totals.collected / totals.expected) * 100);
  const owedBefore = data.students.reduce(
    (sum, row) => sum + Math.max(0, row.owes - row.selected.left),
    0
  );
  const tile = 'flex flex-col gap-1 rounded-2xl border border-border/70 bg-surface px-5 py-4';
  const label = 'text-[13px] font-semibold text-ink-muted';
  const value = 'text-2xl font-bold tracking-tight text-ink tabular-nums';

  return (
    <section
      aria-label={`${monthName(data.month)} for this grade`}
      className="grid gap-3 sm:grid-cols-3"
    >
      <div className={tile}>
        <span className={label}>Collected in {monthName(data.month)}</span>
        <span className={value}>{formatMoney(totals.collected)}</span>
        <span className="text-[13px] text-ink-secondary">
          {percent}% of {formatMoney(totals.expected)}
        </span>
      </div>
      <div className={tile}>
        <span className={label}>Still owed this month</span>
        <span className={value}>{formatMoney(totals.owed)}</span>
        <span className="text-[13px] text-ink-secondary">
          {totals.unpaid} unpaid · {totals.partly} partly paid
        </span>
      </div>
      <div className={tile}>
        <span className={label}>Owed from earlier months</span>
        <span className={value}>{formatMoney(owedBefore)}</span>
        <span className="text-[13px] text-ink-secondary">
          {owedBefore === 0 ? 'Nothing from before' : 'From months before this one'}
        </span>
      </div>
    </section>
  );
}

/* ---------------------------------- Grid ---------------------------------- */

// Students down, months across: who paid, when, and what's left, at a
// glance. Every cell is a button that opens that student's month.
//
// A real <table>: this one IS tabular data (rows × columns that both mean
// something), and screen readers can then announce "Hassan Ali, September".
export function MonthGrid({
  data,
  rows,
  onOpen,
}: {
  data: GradePayments;
  rows: GradePayments['students'];
  onOpen: (studentId: string, month: IsoMonth) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <caption className="sr-only">Payments by student and month</caption>
        <thead>
          <tr className="border-b border-border-strong bg-page text-xs font-semibold uppercase tracking-wide text-ink-muted">
            <th
              scope="col"
              className="px-5 py-2.5"
            >
              Student
            </th>
            {data.months.map((month) => (
              <th
                key={month}
                scope="col"
                className={`px-1.5 py-2.5 text-center ${month === data.month ? 'text-primary' : ''}`}
              >
                {monthName(month).slice(0, 3)}
                {month === data.month && <span className="sr-only"> (selected)</span>}
              </th>
            ))}
            <th
              scope="col"
              className="px-5 py-2.5 text-right"
            >
              Owes
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.student.id}
              className="border-b border-border-strong last:border-b-0"
            >
              <th
                scope="row"
                className="px-5 py-2 font-normal"
              >
                <span className="block text-[15px] font-semibold text-ink">{row.student.name}</span>
                <span className="block text-xs text-ink-muted">
                  {row.groupName}
                  {row.student.discountPercent > 0 && (
                    <span className="font-semibold text-primary">
                      {' '}
                      · −{row.student.discountPercent}%
                    </span>
                  )}
                </span>
              </th>
              {row.cells.map((info) => {
                const text = cellText(info);
                return (
                  <td
                    key={info.month}
                    className="px-1 py-1.5"
                  >
                    <button
                      type="button"
                      onClick={() => onOpen(row.student.id, info.month)}
                      aria-label={cellLabel(row.student.name, info)}
                      className={`
                        flex h-12 w-full cursor-pointer flex-col items-center justify-center rounded-[10px]
                        transition-[filter,box-shadow] hover:brightness-95
                        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
                        ${STATUS_STYLE[info.status].cell}
                        ${info.month === data.month ? 'ring-1 ring-primary/30' : ''}
                      `}
                    >
                      <span className="text-[13px] font-bold tabular-nums">{text.top}</span>
                      {text.bottom && (
                        <span className="text-[11px] font-semibold opacity-85 tabular-nums">
                          {text.bottom}
                        </span>
                      )}
                    </button>
                  </td>
                );
              })}
              <td
                className={`px-5 py-2 text-right text-sm font-bold tabular-nums ${row.owes > 0 ? 'text-danger' : 'text-ink-muted'}`}
              >
                {row.owes > 0 ? formatMoney(row.owes) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------- List ---------------------------------- */

// Phones: a grid of 5 months can't fit, so one month at a time, as a list.
export function MonthList({
  rows,
  onOpen,
}: {
  rows: GradePayments['students'];
  onOpen: (studentId: string, month: IsoMonth) => void;
}) {
  return (
    <ul aria-label="Students this month">
      {rows.map((row) => {
        const info = row.selected;
        const style = STATUS_STYLE[info.status];
        const earlier = row.owes - info.left;

        return (
          <li
            key={row.student.id}
            className="border-b border-border-strong last:border-b-0"
          >
            <button
              type="button"
              onClick={() => onOpen(row.student.id, info.month)}
              className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[15px] font-semibold text-ink">
                  {row.student.name}
                </span>
                <span className="truncate text-xs text-ink-muted">
                  {row.groupName}
                  {row.student.discountPercent > 0 && ` · −${row.student.discountPercent}%`}
                  {info.status === 'partly' && ` · paid ${info.paid} of ${info.due}`}
                  {earlier > 0 && ` · also owes ${formatMoney(earlier)} from before`}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${style.pill}`}>
                  {style.label}
                </span>
                {info.left > 0 && (
                  <span className="text-[13px] font-bold text-danger tabular-nums">
                    {formatMoney(info.left)}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function StatusLegend() {
  const items: MonthStatus[] = ['paid', 'partly', 'unpaid', 'skipped', 'not-due'];
  return (
    <ul
      aria-label="What the colours mean"
      className="flex flex-wrap gap-x-4 gap-y-2 px-5 py-3.5 text-xs text-ink-secondary"
    >
      {items.map((status) => (
        <li
          key={status}
          className="flex items-center gap-1.5"
        >
          <span
            aria-hidden="true"
            className={`h-3.5 w-3.5 rounded ${STATUS_STYLE[status].cell}`}
          />
          {status === 'not-due' ? 'Not due (not joined / future)' : STATUS_STYLE[status].label}
        </li>
      ))}
    </ul>
  );
}
