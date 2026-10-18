import { todayInCairo } from '../../../utils/cairoDate';

import type { IsoMonth, MonthStatus, PaymentMethod } from '../../../api/payments/payments';

export type { IsoMonth, MonthStatus };

// What the payments pages share: months, money, and what the colours mean.
// Pure functions only, no React.

/* --------------------------------- Months --------------------------------- */

// A month is "YYYY-MM" everywhere (URL, API, state): it sorts as text in
// the same order as in time, and it can't be confused with a day.

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isValidMonth = (value: string | null): value is IsoMonth =>
  value !== null && monthPattern.test(value);

// This month in Egypt, not on the browser's clock.
export const currentMonth = (): IsoMonth => todayInCairo().slice(0, 7);

// "2026-10" + 1 -> "2026-11"; "2026-01" - 1 -> "2025-12".
export function addMonths(month: IsoMonth, count: number): IsoMonth {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  const date = new Date(Date.UTC(year, monthNumber - 1 + count, 1));
  return date.toISOString().slice(0, 7);
}

const monthFormat = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthNameFormat = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' });

// "2026-10" -> "October 2026", or just "October".
export const formatMonth = (month: IsoMonth) =>
  monthFormat.format(new Date(`${month}-01T12:00:00Z`));
export const monthName = (month: IsoMonth) =>
  monthNameFormat.format(new Date(`${month}-01T12:00:00Z`));

/* ---------------------------------- Money --------------------------------- */

// Whole Egyptian pounds (the database stores integers, never floats).
const moneyFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
export const formatMoney = (pounds: number) => `EGP ${moneyFormat.format(pounds)}`;

// Collected as a whole percent of expected. Nothing expected counts as
// fully collected (no one owes anything), not as 0%.
export const collectedPercent = (collected: number, expected: number) =>
  expected === 0 ? 100 : Math.min(100, Math.round((collected / expected) * 100));

/* ---------------------------------- Tones --------------------------------- */

// The same thresholds as attendance and marks: 85%+ good, 65%+ watch,
// below that a problem. (Shared with exams/examHelpers.ts in spirit; a
// candidate for one utils/tone.ts when we tidy up.)
export type Tone = 'good' | 'watch' | 'low';

export const toneOf = (percent: number): Tone =>
  percent >= 85 ? 'good' : percent >= 65 ? 'watch' : 'low';

// Softer than the text colours: these fill rings and bars, and the
// overview is meant to read calm.
export const TONE_FILL: Record<Tone, string> = {
  good: 'var(--color-success)',
  watch: 'var(--color-warning)',
  low: 'var(--color-danger)',
};

/* --------------------------------- Status --------------------------------- */

// One look per status, used by the grid, the list and the dialog.
// "Skipped" is grey on purpose: it's not a debt, so it must not look red.
export const STATUS_STYLE: Record<MonthStatus, { label: string; cell: string; pill: string }> = {
  paid: {
    label: 'Paid',
    cell: 'bg-success-tint text-success',
    pill: 'bg-success-tint text-success',
  },
  partly: {
    label: 'Partly paid',
    cell: 'bg-warning-tint text-warning',
    pill: 'bg-warning-tint text-warning',
  },
  unpaid: {
    label: 'Unpaid',
    cell: 'bg-danger-tint text-danger',
    pill: 'bg-danger-tint text-danger',
  },
  skipped: {
    label: 'Skipped',
    cell: 'bg-page text-ink-secondary',
    pill: 'bg-page text-ink-secondary',
  },
  'not-due': {
    label: 'Not due',
    cell: 'border border-dashed border-border-strong text-ink-muted',
    pill: 'bg-page text-ink-muted',
  },
};

/* --------------------------------- Methods -------------------------------- */

export const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'instapay', label: 'InstaPay' },
  { value: 'vodafone-cash', label: 'Vodafone Cash' },
];

/* ---------------------------------- Split --------------------------------- */

// How an amount spreads over the months picked: each month gets what it
// still needs, oldest first; the last month takes whatever is left (so an
// overpayment shows instead of disappearing). For the dialog's PREVIEW only:
// the server applies the same rule when it records the payment.
export function splitAmount(
  months: { month: IsoMonth; needs: number }[],
  amount: number
): { month: IsoMonth; amount: number }[] {
  const ordered = [...months].sort((a, b) => a.month.localeCompare(b.month));
  let remaining = amount;

  return ordered
    .map((item, index) => {
      const part = index === ordered.length - 1 ? remaining : Math.min(item.needs, remaining);
      remaining -= part;
      return { month: item.month, amount: part };
    })
    .filter((part) => part.amount > 0);
}
