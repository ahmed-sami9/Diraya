import type { ActivityEntry } from '../api/activity/activity';

// How each kind of activity reads: the backend stores facts, this file
// words them. One place for every sentence, so rewording (or translating)
// changes old entries too. Pure functions only, unit-tested.

export type ActivityKind = 'student' | 'payment' | 'void' | 'attendance' | 'exam' | 'marks' | 'other';

export type DescribedActivity = {
  kind: ActivityKind; // picks the icon and colour
  title: string; // "Recorded a payment"
  detail: string; // "EGP 350 from Adam Mostafa · October"
  to: string | null; // where clicking it goes, if anywhere
};

const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const formatMoney = (pounds: number) => `EGP ${money.format(pounds)}`;

const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' });
const shortMonth = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });
const shortDay = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

const asMonth = (month: string) => new Date(`${month}-01T12:00:00Z`);

// ["2026-10"] -> "October"; two -> "Sept & Oct"; more -> "Sept – Nov".
export function monthsLabel(months: string[]): string {
  const sorted = [...months].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return '';
  if (sorted.length === 1) return monthName.format(asMonth(first));

  const separator = sorted.length === 2 ? ' & ' : ' – ';
  return `${shortMonth.format(asMonth(first))}${separator}${shortMonth.format(asMonth(last))}`;
}

// "2026-11-02" -> "Mon 2 Nov"
const dayLabel = (day: string) =>
  shortDay.format(new Date(`${day}T12:00:00Z`)).replace(',', '');

export function describeActivity(entry: ActivityEntry): DescribedActivity {
  switch (entry.type) {
    case 'student.added': {
      const d = entry.details;
      return {
        kind: 'student',
        title: 'Added a student',
        detail: `${d.studentName} · ${d.gradeName}, ${d.groupName}`,
        to: `/teacher/students/${d.studentId}`,
      };
    }
    case 'payment.recorded': {
      const d = entry.details;
      return {
        kind: 'payment',
        title: 'Recorded a payment',
        detail: `${formatMoney(d.amount)} from ${d.studentName} · ${monthsLabel(d.months)}`,
        to: `/teacher/students/${d.studentId}`,
      };
    }
    case 'payment.voided': {
      const d = entry.details;
      return {
        kind: 'void',
        title: 'Voided a payment',
        detail: `${formatMoney(d.amount)} from ${d.studentName} · ${d.reason}`,
        to: `/teacher/students/${d.studentId}`,
      };
    }
    case 'attendance.taken': {
      const d = entry.details;
      return {
        kind: 'attendance',
        title: 'Took attendance',
        detail: `${d.groupName} · ${d.gradeName} · ${d.present} of ${d.total} present`,
        to: `/teacher/attendance?groupId=${encodeURIComponent(d.groupId)}&date=${d.day}`,
      };
    }
    case 'exam.added': {
      const d = entry.details;
      return {
        kind: 'exam',
        title: 'Added an exam',
        detail: `${d.title} · ${d.gradeName} · ${dayLabel(d.heldOn)}`,
        to: `/teacher/exams/${d.examId}`,
      };
    }
    case 'marks.entered': {
      const d = entry.details;
      return {
        kind: 'marks',
        title: 'Entered marks',
        detail: `${d.title} · ${d.gradeName} · ${d.entered} of ${d.total} entered`,
        to: `/teacher/exams/${d.examId}`,
      };
    }
    default:
      // A type the backend added before this file learned it: still shown,
      // just plainly, instead of breaking the card.
      return { kind: 'other', title: 'Updated your workspace', detail: '', to: null };
  }
}

/* ---------------------------------- Time ---------------------------------- */

const cairoDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Cairo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const cairoShortDay = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const cairoFullDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

// How long ago, as a feed says it, on Egypt's calendar:
//   under a minute -> "Just now"     under an hour -> "12 min ago"
//   earlier today  -> "3 h ago"      yesterday     -> "Yesterday"
//   this year      -> "Mon 26 Oct"   before        -> "12 Sept 2025"
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;

  const day = cairoDay.format(then);
  const today = cairoDay.format(now);
  if (day === today) return `${Math.floor(minutes / 60)} h ago`;

  const yesterday = cairoDay.format(new Date(now.getTime() - 86_400_000));
  if (day === yesterday) return 'Yesterday';

  return day.slice(0, 4) === today.slice(0, 4)
    ? cairoShortDay.format(then).replace(',', '')
    : cairoFullDate.format(then);
}
