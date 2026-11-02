// Turns the session times the server sends (ISO strings) into the short
// labels shown on the grade cards, on Egypt's clock (not the device's):
//
//   today     -> "Today, 8:00 pm"
//   tomorrow  -> "Tomorrow, 4:00 pm"
//   otherwise -> "Thu 9 Oct, 6:00 pm"

// Created once and reused: building an Intl formatter is the slow part.
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Africa/Cairo',
});

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'Africa/Cairo',
});

// "YYYY-MM-DD" in Cairo; ISO days compare correctly as strings.
const cairoDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Cairo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function shiftDay(isoDay: string, days: number): string {
  const date = new Date(`${isoDay}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export type SessionLabel = {
  // "Today", "Tomorrow", "Yesterday" or "Thu 9 Oct".
  day: string;
  // "8:00 pm"
  time: string;
  isToday: boolean;
};

export function getSessionLabel(isoDate: string, now: Date = new Date()): SessionLabel {
  const date = new Date(isoDate);
  const sessionDay = cairoDay.format(date);
  const today = cairoDay.format(now);

  const isToday = sessionDay === today;

  let day = dayFormat.format(date).replace(',', '');

  if (isToday) day = 'Today';
  else if (sessionDay === shiftDay(today, 1)) day = 'Tomorrow';
  else if (sessionDay === shiftDay(today, -1)) day = 'Yesterday';

  return { day, time: timeFormat.format(date), isToday };
}

// Below this share of students present, attendance is flagged as low.
export const LOW_ATTENDANCE_RATIO = 0.75;

export const isLowAttendance = (presentCount: number, totalCount: number) =>
  totalCount > 0 && presentCount / totalCount < LOW_ATTENDANCE_RATIO;

// "1 student", "12 students"
export const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;
