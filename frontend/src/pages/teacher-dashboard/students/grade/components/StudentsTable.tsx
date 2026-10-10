import { Link } from 'react-router-dom';

import type { GradeStudent, PaymentStatus } from '../../../../../api/students/students';
import ChevronRightIcon from '../../../../../components/icons/ChevronRightIcon';
import { getInitials } from '../../../../../utils/initials';

interface StudentsTableProps {
  students: GradeStudent[];
  // Group id -> group name, to show each student's group.
  groupNames: Map<string, string>;
}

// The same column widths for the header and every row, so they line up.
const COLUMNS = 'md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(104px,1fr)_72px_88px_20px]';

// When a rate counts as good, worth watching, or a problem. One rule for
// attendance and marks, so the colours mean the same thing everywhere.
type Tone = 'good' | 'watch' | 'low';

const toneOf = (percent: number): Tone =>
  percent >= 85 ? 'good' : percent >= 65 ? 'watch' : 'low';

const TONE_TEXT: Record<Tone, string> = {
  good: 'text-success',
  watch: 'text-warning',
  low: 'text-danger',
};

const TONE_BAR: Record<Tone, string> = {
  good: 'bg-success',
  watch: 'bg-warning',
  low: 'bg-danger',
};

const PAYMENT: Record<PaymentStatus, { label: string; classes: string }> = {
  paid: { label: 'Paid', classes: 'bg-success-tint text-success' },
  partial: { label: 'Partly paid', classes: 'bg-warning-tint text-warning' },
  unpaid: { label: 'Unpaid', classes: 'bg-danger-tint text-danger' },
};

// "No data yet": a dash for the eye, words for screen readers.
function NoData() {
  return (
    <span className="text-sm text-ink-muted">
      <span aria-hidden="true">—</span>
      <span className="sr-only">no data yet</span>
    </span>
  );
}

function AttendanceCell({ rate }: { rate: number | null }) {
  if (rate === null) return <NoData />;

  const tone = toneOf(rate);

  return (
    <span className="flex items-center gap-2">
      {/* The bar is decoration; the number says the same thing. */}
      <span
        aria-hidden="true"
        className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-border"
      >
        <span
          className={`block h-full rounded-full ${TONE_BAR[tone]}`}
          style={{ width: `${rate}%` }}
        />
      </span>
      <span className={`text-sm font-semibold tabular-nums ${TONE_TEXT[tone]}`}>{rate}%</span>
    </span>
  );
}

function MarkCell({ mark }: { mark: number | null }) {
  if (mark === null) return <NoData />;

  return (
    <span className={`text-sm font-semibold tabular-nums ${TONE_TEXT[toneOf(mark)]}`}>{mark}%</span>
  );
}

function PaymentBadge({ status }: { status: PaymentStatus | null }) {
  if (status === null) return <NoData />;

  const { label, classes } = PAYMENT[status];

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${classes}`}>
      {label}
    </span>
  );
}

// The grade's students: one row each, and the whole row opens the profile.
//
// Each row carries a quick summary (attendance, marks, this month's fee), so
// a teacher can skim the whole grade and spot who needs attention without
// opening a single profile.
//
// It's a list of links, not a <table>: each row is ONE thing to click, and a
// table can't make a whole row a link without tricks. Hidden labels
// ("Attendance", "Marks"...) make each link read in full for screen readers.
//
// One markup, two layouts: a grid row from tablet width (md:), a compact
// card on phones, where the group moves under the name and only the
// summary values that exist are shown.
function StudentsTable({ students, groupNames }: StudentsTableProps) {
  // Until attendance, exams and payments are recorded, every value is empty.
  // One sentence explains the dashes, instead of leaving them a mystery.
  const hasNoSummaryYet = students.every(
    (student) =>
      student.attendanceRate === null &&
      student.averageMark === null &&
      student.paymentStatus === null
  );

  return (
    <div>
      {/* Column titles: decorative (each row says what it is). Tablet and up.
          A tinted band with a firm line under it, so the header reads as
          separate from the first row. */}
      <div
        aria-hidden="true"
        className={`
          hidden items-center gap-4 border-b border-border-strong bg-page px-5 py-2.5
          text-xs font-semibold uppercase tracking-wide text-ink-muted
          md:grid ${COLUMNS}
        `}
      >
        <span>Student</span>
        <span>Group</span>
        <span>Attendance</span>
        <span>Marks</span>
        <span>Payment</span>
        <span />
      </div>

      <ul aria-label="Students">
        {students.map((student) => {
          const groupName = groupNames.get(student.groupId) ?? '';
          const hasSummary =
            student.attendanceRate !== null ||
            student.averageMark !== null ||
            student.paymentStatus !== null;

          return (
            <li
              key={student.id}
              // border-border-strong: the soft card border is too faint to
              // separate rows at a glance.
              className="border-b border-border-strong last:border-b-0"
            >
              <Link
                to={`/teacher/students/${student.id}`}
                className={`
                  flex items-center gap-3 px-4 py-3
                  transition-colors
                  hover:bg-surface-hover
                  focus-visible:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary
                  md:grid md:gap-4 md:px-5 ${COLUMNS}
                `}
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-[13px] font-bold text-primary"
                  >
                    {getInitials(student.name)}
                  </span>

                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-semibold text-ink">
                      {student.name}
                    </span>
                    <span className="truncate text-[13px] text-ink-secondary">
                      <span className="font-mono">{student.code}</span>
                      {/* Phones: the group has no column, so it goes here. */}
                      <span className="md:hidden"> · {groupName}</span>
                    </span>

                    {/* Phones: the summary values that exist, on one line. */}
                    {hasSummary && (
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 md:hidden">
                        {student.attendanceRate !== null && (
                          <span className="flex items-center gap-1 text-xs text-ink-secondary">
                            <span>Attendance</span>
                            <AttendanceCell rate={student.attendanceRate} />
                          </span>
                        )}
                        {student.averageMark !== null && (
                          <span className="flex items-center gap-1 text-xs text-ink-secondary">
                            <span>Marks</span>
                            <MarkCell mark={student.averageMark} />
                          </span>
                        )}
                        {student.paymentStatus !== null && (
                          <PaymentBadge status={student.paymentStatus} />
                        )}
                      </span>
                    )}
                  </span>
                </span>

                {/* Tablet and up: one column each. */}
                <span className="hidden truncate text-sm text-ink-secondary md:block">
                  <span className="sr-only">Group: </span>
                  {groupName}
                </span>

                <span className="hidden md:block">
                  <span className="sr-only">Attendance: </span>
                  <AttendanceCell rate={student.attendanceRate} />
                </span>

                <span className="hidden md:block">
                  <span className="sr-only">Marks: </span>
                  <MarkCell mark={student.averageMark} />
                </span>

                <span className="hidden md:block">
                  <span className="sr-only">Payment: </span>
                  <PaymentBadge status={student.paymentStatus} />
                </span>

                <ChevronRightIcon className="h-[18px] w-[18px] shrink-0 text-ink-muted" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default StudentsTable;
