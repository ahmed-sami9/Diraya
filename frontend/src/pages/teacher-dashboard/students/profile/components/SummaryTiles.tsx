import type { ReactNode } from 'react';

import { pluralize } from '../../../../../utils/formatSession';

import {
  ATTENDANCE_STATUS,
  PAYMENT_STATUS,
  TONE_TEXT,
  formatLongDate,
  formatMoney,
  formatMonth,
  toneOf,
} from '../profileFormat';
import type { StudentSummary } from '../profileTypes';

interface TileProps {
  label: string;
  // The big value. null: "no data yet", shown as a dash.
  value: ReactNode | null;
  detail: ReactNode;
}

function Tile({ label, value, detail }: TileProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[14px] border border-border bg-surface px-5 py-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
      <span className="min-h-9 text-[28px] font-extrabold leading-9 tabular-nums text-ink">
        {value ?? (
          <span className="text-ink-muted">
            <span aria-hidden="true">—</span>
            <span className="sr-only">no data yet</span>
          </span>
        )}
      </span>
      <span className="text-[13px] text-ink-secondary">{detail}</span>
    </div>
  );
}

// The four numbers a teacher checks first. Each tile reads one part of
// `summary`, and each has a "no data yet" form for a new student.
function SummaryTiles({ summary }: { summary: StudentSummary }) {
  const { attendance, marks, currentFee, lastSession } = summary;

  const change = marks.changeSinceLastMonth;

  return (
    <section
      aria-label="Summary"
      // 2 per row on phones, 4 on wide screens.
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      <Tile
        label="Attendance"
        value={
          attendance.rate === null ? null : (
            <span className={TONE_TEXT[toneOf(attendance.rate)]}>{attendance.rate}%</span>
          )
        }
        detail={
          attendance.total === 0
            ? 'No sessions yet'
            : `${attendance.attended} of ${pluralize(attendance.total, 'session')}`
        }
      />

      <Tile
        label="Average mark"
        value={marks.average === null ? null : `${marks.average}%`}
        detail={
          marks.examCount === 0 ? (
            'No exams yet'
          ) : (
            <>
              {pluralize(marks.examCount, 'exam')}
              {change !== null && change !== 0 && (
                <span className={`font-semibold ${change > 0 ? 'text-success' : 'text-danger'}`}>
                  {' '}
                  · {change > 0 ? 'up' : 'down'} {Math.abs(change)} points
                </span>
              )}
            </>
          )
        }
      />

      <Tile
        label={
          currentFee
            ? `${formatMonth(currentFee.month, { withYear: false })} fee`
            : 'This month’s fee'
        }
        value={
          currentFee ? (
            <span
              className={`inline-flex rounded-full px-3 py-1 align-middle text-sm font-bold ${PAYMENT_STATUS[currentFee.status].classes}`}
            >
              {PAYMENT_STATUS[currentFee.status].label}
            </span>
          ) : null
        }
        detail={
          currentFee
            ? `${formatMoney(currentFee.amountPaid)} of ${formatMoney(currentFee.amountDue)}`
            : 'No fees recorded yet'
        }
      />

      <Tile
        label="Last session"
        value={
          lastSession ? (
            <span className="text-xl font-bold">{ATTENDANCE_STATUS[lastSession.status].label}</span>
          ) : null
        }
        detail={
          lastSession
            ? `${formatLongDate(lastSession.heldAt)} · ${lastSession.groupName}`
            : 'No sessions yet'
        }
      />
    </section>
  );
}

export default SummaryTiles;
