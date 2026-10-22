// Dates in Egypt's calendar, as "YYYY-MM-DD".
//
// Classes happen on Egyptian days. The server may run anywhere (and in UTC),
// so "today" always means today in Africa/Cairo, never the server's clock.
// 'en-CA' happens to format as YYYY-MM-DD.
const cairoDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Cairo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const todayInCairo = (now: Date = new Date()): string => cairoDay.format(now);

// A real calendar day in "YYYY-MM-DD" form (rejects "2026-02-30" too).
export function isValidIsoDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T12:00:00Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const currentMonthInCairo = (now: Date = new Date()): string =>
  todayInCairo(now).slice(0, 7);
