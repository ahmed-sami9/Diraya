import type { GroupSession } from '../api/students/groups';

// Turns a group's weekly sessions into the short label on its tab:
//
//   [Sat 16:00, Tue 16:00]  -> "Sat & Tue · 4:00 pm"
//   [Sat 16:00, Mon 18:00]  -> "Sat 4:00 pm · Mon 6:00 pm"
//   []                      -> "No schedule yet"

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// The teaching week in Egypt starts on Saturday, so days are listed
// Saturday first: Sat, Sun, Mon … Fri.
const weekOrder = (dayOfWeek: number) => (dayOfWeek + 1) % 7;

// "16:00" -> "4:00 pm"
export function formatTime(startTime: string): string {
  const [hours = 0, minutes = 0] = startTime.split(':').map(Number);
  const suffix = hours >= 12 ? 'pm' : 'am';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function formatGroupSchedule(sessions: GroupSession[]): string {
  if (sessions.length === 0) return 'No schedule yet';

  const sorted = [...sessions].sort(
    (a, b) =>
      weekOrder(a.dayOfWeek) - weekOrder(b.dayOfWeek) || a.startTime.localeCompare(b.startTime)
  );

  const sameTime = sorted.every((session) => session.startTime === sorted[0]?.startTime);

  if (sameTime) {
    const days = sorted.map((session) => DAY_NAMES[session.dayOfWeek]).join(' & ');

    return `${days} · ${formatTime(sorted[0]!.startTime)}`;
  }

  return sorted
    .map((session) => `${DAY_NAMES[session.dayOfWeek]} ${formatTime(session.startTime)}`)
    .join(' · ');
}
