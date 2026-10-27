import { Link } from 'react-router-dom';

import type { PaymentMethod, PaymentsOverview } from '../../../../api/payments/payments';
import {
  TONE_FILL,
  collectedPercent,
  earlierOwedLink,
  formatMoney,
  monthName,
  toneOf,
  type IsoMonth,
} from '../paymentsHelpers';

// The sections of the payments overview (All grades). Each only displays what it's
// given; the page owns the data, the month and the filter.
//
// Two columns on wide screens: the three "at a glance" cards stacked in a
// narrow column on the left, the lists on the right. On phones and tablets
// the column simply comes first.

const card = 'rounded-[18px] border border-border/70 bg-surface';
const cardLabel = 'text-[13px] font-semibold text-ink-muted';

/* ------------------------------- Collected ------------------------------- */

// The one share-of-a-whole on the page, so it's the one circle: what came
// in, out of what this month should bring in.
function CollectedCard({
  collected,
  expected,
  month,
}: {
  collected: number;
  expected: number;
  month: IsoMonth;
}) {
  const percent = collectedPercent(collected, expected);
  const radius = 48;
  const circumference = 2 * Math.PI * radius;

  return (
    <section
      aria-labelledby="collected-title"
      className={`${card} flex flex-col items-center gap-4 p-5 sm:p-6`}
    >
      <h2
        id="collected-title"
        className={`${cardLabel} self-start`}
      >
        Collected in {monthName(month)}
      </h2>

      <div className="relative h-[156px] w-[156px]">
        <svg
          role="img"
          aria-label={`${percent}% of the expected amount collected`}
          viewBox="0 0 120 120"
          className="h-full w-full -rotate-90"
        >
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="10"
            className="stroke-border/60"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            stroke={TONE_FILL[toneOf(percent)]}
            // The filled part, then a gap as long as the whole circle.
            strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
            className="transition-[stroke-dasharray] duration-500 motion-reduce:transition-none"
          />
        </svg>
        <span
          aria-hidden="true"
          className="absolute inset-0 flex flex-col items-center justify-center"
        >
          <span className="text-[30px] font-bold tracking-tight text-ink tabular-nums">
            {percent}%
          </span>
          <span className="text-xs text-ink-muted">collected</span>
        </span>
      </div>

      <dl className="flex w-full justify-between gap-4 text-[13px] text-ink-muted">
        <div className="flex flex-col gap-0.5">
          <dt>Collected</dt>
          <dd className="text-base font-bold text-ink tabular-nums">{formatMoney(collected)}</dd>
        </div>
        <div className="flex flex-col gap-0.5 text-right">
          <dt>Expected</dt>
          <dd className="text-base font-semibold text-ink-secondary tabular-nums">
            {formatMoney(expected)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

/* --------------------------------- Owed ---------------------------------- */

// A plain amount: there's no "whole" for it to be a share of.
function OwedCard({ owed, unpaid, partly }: { owed: number; unpaid: number; partly: number }) {
  return (
    <section
      aria-labelledby="owed-title"
      className={`${card} flex flex-col gap-1.5 p-5 sm:px-6`}
    >
      <h2
        id="owed-title"
        className={cardLabel}
      >
        Still owed this month
      </h2>
      <span className="text-[26px] font-bold tracking-tight text-ink tabular-nums">
        {formatMoney(owed)}
      </span>
      <span className="flex items-center gap-1.5 text-[13px] text-ink-muted">
        {owed > 0 && (
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-danger/80"
          />
        )}
        {owed > 0 ? `${unpaid} unpaid · ${partly} partly paid` : 'Everyone is paid up'}
      </span>
    </section>
  );
}

/* -------------------------------- Students ------------------------------- */

const STATUS_ROWS = [
  { key: 'paid', label: 'Paid', dot: 'bg-success/80' },
  { key: 'partly', label: 'Partly paid', dot: 'bg-warning/70' },
  { key: 'unpaid', label: 'Unpaid', dot: 'bg-danger/80' },
  { key: 'skipped', label: 'Skipped this month', dot: 'bg-ink-muted/40' },
] as const;

// Four parts of a whole: a thin bar for the shape, a list for the numbers.
// (A four-slice donut is hard to compare; a bar plus a legend isn't.)
function StudentsCard({ counts }: { counts: PaymentsOverview['totals']['students'] }) {
  const total = counts.paid + counts.partly + counts.unpaid + counts.skipped;

  return (
    <section
      aria-labelledby="students-title"
      className={`${card} flex flex-col gap-3 p-5 sm:px-6`}
    >
      <h2
        id="students-title"
        className={cardLabel}
      >
        {total} {total === 1 ? 'student' : 'students'}
      </h2>

      {total > 0 && (
        <span
          aria-hidden="true"
          className="flex h-2 gap-0.5 overflow-hidden rounded-full"
        >
          {STATUS_ROWS.map(({ key, dot }) =>
            counts[key] > 0 ? (
              <span
                key={key}
                className={dot}
                style={{ flexGrow: counts[key] }}
              />
            ) : null
          )}
        </span>
      )}

      <ul className="flex flex-col gap-2 text-sm">
        {STATUS_ROWS.map(({ key, label, dot }) => (
          <li
            key={key}
            className="flex items-center gap-2.5"
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${dot}`}
            />
            <span className="flex-1 text-ink-secondary">{label}</span>
            <span className="font-bold text-ink tabular-nums">{counts[key]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AtAGlance({ overview }: { overview: PaymentsOverview }) {
  const { totals } = overview;

  return (
    <aside
      aria-label="This month at a glance"
      // A row of cards on tablets (they're short), a column beside the
      // lists from laptop width.
      className="grid gap-3.5 sm:grid-cols-2 lg:flex lg:w-[320px] lg:shrink-0 lg:flex-col"
    >
      <div className="sm:row-span-2">
        <CollectedCard
          collected={totals.collected}
          expected={totals.expected}
          month={overview.month}
        />
      </div>
      <OwedCard
        owed={totals.owed}
        unpaid={totals.students.unpaid}
        partly={totals.students.partly}
      />
      <StudentsCard counts={totals.students} />
    </aside>
  );
}

/* ---------------------------- Owed from before --------------------------- */

export function EarlierOwedBanner({
  earlier,
}: {
  earlier: NonNullable<PaymentsOverview['earlierOwed']>;
}) {
  return (
    <Link
      to={earlierOwedLink(earlier)}
      className="
        flex flex-wrap items-center gap-x-3 gap-y-1
        rounded-2xl border border-danger/15 bg-danger-tint/60 px-4 py-3.5 text-danger
        transition-colors hover:bg-danger-tint
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
        sm:px-5
      "
    >
      <span className="min-w-[200px] flex-1 text-sm">
        <strong>Owed from earlier months</strong> · {earlier.students}{' '}
        {earlier.students === 1 ? 'student still owes' : 'students still owe'}{' '}
        {formatMoney(earlier.amount)}
      </span>
      <span className="text-sm font-bold">See who →</span>
    </Link>
  );
}

/* --------------------------------- Shared --------------------------------- */

function SectionTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2
      id={id}
      className="text-[13px] font-bold uppercase tracking-wider text-ink-muted"
    >
      {children}
    </h2>
  );
}

/* --------------------------------- Latest -------------------------------- */

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  instapay: 'InstaPay',
  'vodafone-cash': 'Vodafone Cash',
};

const shortDay = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const formatDay = (day: string) => shortDay.format(new Date(`${day}T12:00:00Z`));

export function LatestPayments({ payments }: { payments: PaymentsOverview['latest'] }) {
  return (
    <section
      aria-labelledby="latest-title"
      className="flex flex-col gap-3"
    >
      <SectionTitle id="latest-title">Latest payments</SectionTitle>

      {payments.length === 0 ? (
        <p className="text-sm text-ink-secondary">Nothing recorded this month yet.</p>
      ) : (
        <ul
          aria-label="Latest payments"
          className="overflow-hidden rounded-2xl border border-border bg-surface"
        >
          {payments.map((payment) => (
            <li
              key={payment.id}
              className="flex items-center gap-4 border-b border-border-strong px-4 py-3 last:border-b-0 sm:px-5"
            >
              {/* Tablet and up: the date and the method get their own columns. */}
              <span className="hidden w-14 shrink-0 text-[13px] text-ink-muted sm:block">
                {formatDay(payment.paidOn)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Link
                  to={`/teacher/students/${payment.student.id}/payments`}
                  className="truncate text-[15px] font-semibold text-ink hover:text-primary"
                >
                  {payment.student.name}
                </Link>
                <span className="truncate text-xs text-ink-muted">
                  {/* Phones: date and method fold into this line. */}
                  <span className="sm:hidden">
                    {formatDay(payment.paidOn)} · {METHOD_LABEL[payment.method]} ·{' '}
                  </span>
                  {payment.grade.name} · for {payment.months.map(monthName).join(' + ')}
                </span>
              </span>
              <span className="hidden shrink-0 rounded-full bg-page px-2.5 py-0.5 text-xs font-semibold text-ink-secondary sm:inline-flex">
                {METHOD_LABEL[payment.method]}
              </span>
              <span className="shrink-0 text-right text-[15px] font-bold text-ink tabular-nums sm:w-24">
                {formatMoney(payment.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
