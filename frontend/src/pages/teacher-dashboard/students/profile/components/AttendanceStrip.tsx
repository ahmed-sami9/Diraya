import { ATTENDANCE_STATUS, formatLongDate, formatShortDate } from '../profileFormat';
import type { AttendanceRecord, AttendanceStatus } from '../profileTypes';

interface AttendanceStripProps {
  // Newest first, as the API sends them. Shown oldest -> newest, left to
  // right, the way a timeline reads.
  records: AttendanceRecord[];
}

// One square per session: ✓ present, L late, ✕ absent, E excused.
//
// A list, so screen readers hear "6 Sep, Present" for each one; the symbol
// inside the square is decoration for the eye.
function AttendanceStrip({ records }: AttendanceStripProps) {
  const inTimeOrder = [...records].reverse();

  return (
    <ul
      aria-label="Sessions"
      className="flex flex-wrap gap-2.5"
    >
      {inTimeOrder.map((record) => {
        const status = ATTENDANCE_STATUS[record.status];
        const detail = [record.isMakeUp ? `make-up with ${record.groupName}` : null, record.reason]
          .filter(Boolean)
          .join(', ');

        return (
          <li
            key={record.sessionId}
            className="flex w-11 flex-col items-center gap-1.5"
          >
            <span
              aria-hidden="true"
              title={`${formatLongDate(record.heldAt)}: ${status.label}${detail ? ` (${detail})` : ''}`}
              className={`
                relative flex h-9 w-9 items-center justify-center rounded-[9px]
                text-[15px] font-bold ${status.classes}
              `}
            >
              {status.symbol}
              {/* A small dot marks a make-up session in another group. */}
              {record.isMakeUp && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-primary" />
              )}
            </span>
            <span className="whitespace-nowrap text-[11px] text-ink-muted">
              {formatShortDate(record.heldAt)}
            </span>
            <span className="sr-only">
              {status.label}
              {detail && `, ${detail}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// The key under the strip. Shown once per section, not per square.
export function AttendanceLegend() {
  const statuses = Object.keys(ATTENDANCE_STATUS) as AttendanceStatus[];

  return (
    <div
      aria-hidden="true"
      className="flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-ink-secondary"
    >
      {statuses.map((key) => (
        <span
          key={key}
          className="flex items-center gap-1.5"
        >
          <span
            className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] text-[11px] font-bold ${ATTENDANCE_STATUS[key].classes}`}
          >
            {ATTENDANCE_STATUS[key].symbol}
          </span>
          {ATTENDANCE_STATUS[key].label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-primary" />
        Make-up in another group
      </span>
    </div>
  );
}

export default AttendanceStrip;
