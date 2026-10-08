// Turns the session times the server sends (ISO strings) into the short
// labels shown on the grade cards, in the teacher's own time zone:
//
//   today     -> "Today, 8:00 pm"
//   tomorrow  -> "Tomorrow, 4:00 pm"
//   otherwise -> "Thu 9 Oct, 6:00 pm"

// Created once and reused: building an Intl formatter is the slow part.
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export type SessionLabel = {
  // "Today", "Tomorrow", "Yesterday" or "Thu 9 Oct".
  day: string;
  // "8:00 pm"
  time: string;
  isToday: boolean;
};

export function getSessionLabel(isoDate: string, now: Date = new Date()): SessionLabel {
  const date = new Date(isoDate);

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const isToday = isSameDay(date, now);

  let day = dayFormat.format(date).replace(',', '');

  if (isToday) day = 'Today';
  else if (isSameDay(date, tomorrow)) day = 'Tomorrow';
  else if (isSameDay(date, yesterday)) day = 'Yesterday';

  return { day, time: timeFormat.format(date), isToday };
}

// Below this share of students present, attendance is flagged as low.
export const LOW_ATTENDANCE_RATIO = 0.75;

export const isLowAttendance = (presentCount: number, totalCount: number) =>
  totalCount > 0 && presentCount / totalCount < LOW_ATTENDANCE_RATIO;

// "1 student", "12 students"
export const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;
