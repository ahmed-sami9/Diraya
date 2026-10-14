// Dates in Egypt's calendar, as "YYYY-MM-DD".
//
// The browser's clock may be set to another time zone (a teacher travelling,
// a wrong setting), but a class "on Sunday" means Sunday in Egypt. 'en-CA'
// happens to format as YYYY-MM-DD, the format <input type="date"> uses.
const cairoDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Cairo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const todayInCairo = (now: Date = new Date()) => cairoDay.format(now);

const isoDayPattern = /^\d{4}-\d{2}-\d{2}$/;

// A real calendar day in "YYYY-MM-DD" form (rejects "2026-02-30" too).
export function isValidIsoDay(value: string): boolean {
  if (!isoDayPattern.test(value)) return false;

  const date = new Date(`${value}T12:00:00Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// "2026-10-12" -> "Monday 12 October"
const longDay = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

export const formatIsoDay = (day: string) => longDay.format(new Date(`${day}T12:00:00Z`));
