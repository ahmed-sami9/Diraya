import type { PaymentStatus } from '../../../../api/students/students';

import type { AttendanceRecord, AttendanceStatus } from './profileTypes';

// Display rules shared by the profile's sections: how a date, a month, a
// rate or a status looks. One place, so every section says it the same way.

const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const longDate = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const monthYear = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const monthOnly = new Intl.DateTimeFormat('en-GB', { month: 'long' });

// "2026-09-06T…" -> "6 Sep"
export const formatShortDate = (iso: string) => shortDate.format(new Date(iso));

// "2026-09-20T…" -> "Sat 20 Sep"
export const formatLongDate = (iso: string) => longDate.format(new Date(iso)).replace(',', '');

// "2026-10" -> "October 2026", or "October" with { withYear: false }
export function formatMonth(month: string, { withYear = true } = {}): string {
  const [year = 1970, monthNumber = 1] = month.split('-').map(Number);
  const date = new Date(year, monthNumber - 1, 1);

  return (withYear ? monthYear : monthOnly).format(date);
}

// 350 -> "350 EGP"
export const formatMoney = (amount: number) => `${amount.toLocaleString('en-GB')} EGP`;

/* -------------------------------- Rates ---------------------------------- */

// The same thresholds as the grade table, so a colour means the same thing
// on both pages.
export type Tone = 'good' | 'watch' | 'low';

export const toneOf = (percent: number): Tone =>
  percent >= 85 ? 'good' : percent >= 65 ? 'watch' : 'low';

export const TONE_TEXT: Record<Tone, string> = {
  good: 'text-success',
  watch: 'text-warning',
  low: 'text-danger',
};

export const TONE_BAR: Record<Tone, string> = {
  good: 'bg-success',
  watch: 'bg-warning',
  low: 'bg-danger',
};

/* ------------------------------- Statuses -------------------------------- */

// Each status has a symbol as well as a colour: red and green look alike to
// colour-blind teachers, so the symbol carries the meaning.
export const ATTENDANCE_STATUS: Record<
  AttendanceStatus,
  { label: string; symbol: string; classes: string }
> = {
  present: { label: 'Present', symbol: '✓', classes: 'bg-success text-surface' },
  late: { label: 'Late', symbol: 'L', classes: 'bg-warning-tint text-warning' },
  absent: {
    label: 'Absent',
    symbol: '✕',
    classes: 'border-2 border-danger bg-surface text-danger',
  },
  excused: { label: 'Excused', symbol: 'E', classes: 'bg-primary-tint text-primary' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; classes: string }> = {
  paid: { label: 'Paid', classes: 'bg-success-tint text-success' },
  partial: { label: 'Partly paid', classes: 'bg-warning-tint text-warning' },
  unpaid: { label: 'Unpaid', classes: 'bg-danger-tint text-danger' },
};

/* ------------------------------- Grouping -------------------------------- */

export type AttendanceMonth = {
  // "2026-10"
  month: string;
  records: AttendanceRecord[];
  attended: number;
};

// Records (newest first) -> one block per month, newest month first.
// "Attended" counts present and late: a late student still came.
export function groupAttendanceByMonth(records: AttendanceRecord[]): AttendanceMonth[] {
  const months = new Map<string, AttendanceMonth>();

  for (const record of records) {
    const month = record.heldAt.slice(0, 7);
    const entry = months.get(month) ?? { month, records: [], attended: 0 };

    entry.records.push(record);
    if (record.status === 'present' || record.status === 'late') entry.attended += 1;

    months.set(month, entry);
  }

  return [...months.values()];
}
