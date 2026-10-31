import type { StudentProfile } from '../../../../../api/students/profile';
import type { PaymentStatus } from '../../../../../api/students/students';

// The WhatsApp message a teacher sends a parent: the profile's four summary
// tiles, in plain words. *Stars* are WhatsApp's bold.
//
// No imports at run time (types only), so it's tested as plain functions.

const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' });
const sessionDay = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'Africa/Cairo',
});

const money = (amount: number) => `${amount.toLocaleString('en-GB')} EGP`;

const SESSION_STATUS = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  excused: 'Excused absence',
} as const;

function feeText(fee: NonNullable<StudentProfile['summary']['currentFee']>): string {
  const texts: Record<PaymentStatus, string> = {
    paid: `Paid (${money(fee.amountPaid)})`,
    partly: `Partly paid, ${fee.amountPaid.toLocaleString('en-GB')} of ${money(fee.amountDue)}`,
    unpaid: `Not paid yet (${money(fee.amountDue)})`,
    skipped: 'Skipped this month',
    'not-due': 'Nothing due',
  };

  return texts[fee.status];
}

export function buildParentMessage(profile: StudentProfile, teacherName: string): string {
  const { attendance, marks, currentFee, lastSession } = profile.summary;
  const firstName = profile.name.split(' ')[0];
  const lines: string[] = [];

  // Only what has data: a parent shouldn't read "no data yet" four times.
  if (attendance.rate !== null) {
    lines.push(
      `*Attendance:* ${attendance.rate}% (${attendance.attended} of ${attendance.total} sessions)`
    );
  }

  if (marks.average !== null) {
    const change = marks.changeSinceLastMonth;
    const trend =
      change === null || change === 0
        ? ''
        : `, ${change > 0 ? 'up' : 'down'} ${Math.abs(change)} points from last month`;
    const exams = marks.examCount === 1 ? '1 exam' : `${marks.examCount} exams`;
    lines.push(`*Average mark:* ${marks.average}% across ${exams}${trend}`);
  }

  if (currentFee) {
    // "2026-10" -> "October"; UTC on both sides so the month can't shift.
    const month = monthName.format(new Date(`${currentFee.month}-01T00:00:00Z`));
    lines.push(`*${month} fee:* ${feeText(currentFee)}`);
  }

  if (lastSession) {
    const day = sessionDay.format(new Date(lastSession.heldAt)).replace(',', '');
    lines.push(`*Last session:* ${SESSION_STATUS[lastSession.status]} on ${day}`);
  }

  return [
    `Hello! This is ${teacherName}, ${firstName}’s teacher. Here is a quick update on ${profile.name}:`,
    lines.length > 0 ? lines.join('\n') : 'Nothing has been recorded yet; I’ll share more soon.',
    'Feel free to reply here with any questions.',
  ].join('\n\n');
}
