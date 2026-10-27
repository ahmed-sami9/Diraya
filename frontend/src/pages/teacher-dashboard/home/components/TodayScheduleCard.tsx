import { Link } from 'react-router-dom';

import Card from '../../../../components/Card';
import EmptyState from '../../../../components/EmptyState';
import CalendarIcon from '../../../../components/icons/CalendarIcon';
import CheckCircleIcon from '../../../../components/icons/CheckCircleIcon';
import type { HomeSummaryState } from '../../../../hooks/home/useHomeSummary';
import { formatTime } from '../../../../utils/formatSchedule';

import { attendanceLink, todayProgress } from '../todayClasses';

interface TodayScheduleCardProps {
  state: HomeSummaryState;
  onRetry: () => void;
}

const buttonBase = `
  flex h-10 shrink-0 items-center justify-center gap-1.5
  rounded-[10px] px-3.5 text-[13px] font-semibold
  transition-colors
  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
`;

/** Today's classes from the groups' timetables, each with its attendance status. */
function TodayScheduleCard({ state, onRetry }: TodayScheduleCardProps) {
  if (state.status === 'loading') {
    return (
      <Card title="Today's schedule">
        <ul aria-hidden="true" className="divide-y divide-border">
          {[0, 1].map((row) => (
            <li key={row} className="flex items-center gap-4 px-5 py-4">
              <span className="h-4 w-16 animate-pulse rounded bg-surface-hover" />
              <span className="h-4 flex-1 animate-pulse rounded bg-surface-hover" />
            </li>
          ))}
        </ul>
        <p className="sr-only">Loading today’s classes…</p>
      </Card>
    );
  }

  if (state.status === 'error') {
    return (
      <Card title="Today's schedule">
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-5 py-5">
          <p className="text-sm text-ink-secondary">We couldn’t load today’s classes.</p>
          <button
            type="button"
            onClick={onRetry}
            className={`${buttonBase} cursor-pointer border border-border bg-surface text-ink hover:bg-surface-hover`}
          >
            Try again
          </button>
        </div>
      </Card>
    );
  }

  const { date, classes } = state.summary.classesToday;
  const { total, taken, next } = todayProgress(classes);

  if (total === 0) {
    return (
      <Card title="Today's schedule">
        <EmptyState
          icon={<CalendarIcon className="h-6 w-6" />}
          title="No classes today"
          description="Classes from your groups’ timetables appear here on the day they run."
        />
      </Card>
    );
  }

  return (
    <Card
      title="Today's schedule"
      action={
        <span className="text-[13px] font-medium text-ink-muted">
          {taken} of {total} taken
        </span>
      }
    >
      <ul className="divide-y divide-border">
        {classes.map((item) => {
          const isNext = item === next;

          return (
            <li
              key={item.groupId}
              // On phones the button drops under the class name.
              className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 ${isNext ? 'bg-primary-tint/50' : ''}`}
            >
              <span className="w-[72px] shrink-0 text-sm font-bold tabular-nums text-ink">
                {formatTime(item.startTime)}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-ink">{item.groupName}</span>
                  {isNext && (
                    <span className="shrink-0 rounded-full bg-primary-solid px-2 py-0.5 text-[11px] font-bold text-white">
                      Next
                    </span>
                  )}
                </span>
                <span className="block truncate text-[13px] text-ink-secondary">{item.gradeName}</span>
              </span>

              {item.taken ? (
                <Link
                  to={attendanceLink(item.groupId, date)}
                  aria-label={`Attendance taken for ${item.groupName}. View the sheet`}
                  className={`${buttonBase} basis-full bg-success-tint text-success hover:opacity-90 sm:basis-auto`}
                >
                  <CheckCircleIcon className="h-4 w-4" />
                  Taken
                </Link>
              ) : (
                <Link
                  to={attendanceLink(item.groupId, date)}
                  aria-label={`Take attendance for ${item.groupName}`}
                  className={`${buttonBase} basis-full sm:basis-auto ${
                    isNext
                      ? 'bg-primary-solid text-white hover:bg-primary-hover'
                      : 'border border-border bg-surface text-ink hover:bg-surface-hover'
                  }`}
                >
                  Take attendance
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default TodayScheduleCard;
