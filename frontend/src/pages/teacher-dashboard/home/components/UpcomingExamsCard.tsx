import { Link } from 'react-router-dom';

import Card from '../../../../components/Card';
import EmptyState from '../../../../components/EmptyState';
import ExamsIcon from '../../../../components/icons/ExamsIcon';
import type { useExams } from '../../../../hooks/exams/useExams';
import {
  KIND_LABEL,
  asDate,
  dayNumber,
  examPath,
  shortDay,
  shortMonth,
  upcomingExams,
  whenLabel,
} from '../../exams/examHelpers';

// A side-column card: the next few, not the whole term.
const SHOWN = 3;

interface UpcomingExamsCardProps {
  state: ReturnType<typeof useExams>['state'];
  today: string;
  onRetry: () => void;
}

/** The next exams, soonest first: the same list as the Exams page's "Upcoming". */
function UpcomingExamsCard({ state, today, onRetry }: UpcomingExamsCardProps) {
  if (state.status === 'loading') {
    return (
      <Card title="Upcoming exams">
        <ul aria-hidden="true" className="divide-y divide-border">
          {[0, 1].map((row) => (
            <li key={row} className="flex items-center gap-3 px-5 py-4">
              <span className="h-11 w-11 animate-pulse rounded-[10px] bg-surface-hover" />
              <span className="h-4 flex-1 animate-pulse rounded bg-surface-hover" />
            </li>
          ))}
        </ul>
        <p className="sr-only">Loading upcoming exams…</p>
      </Card>
    );
  }

  if (state.status === 'error') {
    return (
      <Card title="Upcoming exams">
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-5 py-5">
          <p className="text-sm text-ink-secondary">We couldn’t load your exams.</p>
          <button
            type="button"
            onClick={onRetry}
            className="
              flex h-10 cursor-pointer items-center rounded-[10px] border border-border bg-surface
              px-3.5 text-[13px] font-semibold text-ink transition-colors hover:bg-surface-hover
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
            "
          >
            Try again
          </button>
        </div>
      </Card>
    );
  }

  const upcoming = upcomingExams(state.exams, today);

  if (upcoming.length === 0) {
    return (
      <Card title="Upcoming exams">
        <EmptyState
          icon={<ExamsIcon className="h-6 w-6" />}
          title="No exams scheduled"
          description="Add a quiz or exam and it will appear here."
          // ?new=1 opens the Add exam dialog straight away.
          action={{ label: 'Add exam', to: '/teacher/exams?new=1' }}
        />
      </Card>
    );
  }

  const hidden = upcoming.length - SHOWN;

  return (
    <Card
      title="Upcoming exams"
      action={
        <Link
          to="/teacher/exams"
          className="
            rounded-md text-[13px] font-semibold text-primary hover:underline
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
          "
        >
          {hidden > 0 ? `View all (${upcoming.length})` : 'View all'}
        </Link>
      }
    >
      <ul className="divide-y divide-border">
        {upcoming.slice(0, SHOWN).map((exam) => {
          const date = asDate(exam.heldOn);

          return (
            <li key={exam.id}>
              <Link
                to={examPath(exam.id)}
                className="
                  flex items-center gap-3 px-5 py-3.5
                  transition-colors hover:bg-surface-hover
                  focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary
                "
              >
                {/* The same calendar tile as the Exams page, smaller. */}
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-[10px] bg-primary-tint text-primary"
                >
                  <span className="text-base font-extrabold leading-none">{dayNumber.format(date)}</span>
                  <span className="text-[10px] font-bold uppercase">{shortMonth.format(date)}</span>
                </span>

                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-ink">{exam.title}</span>
                  <span className="truncate text-[13px] text-ink-secondary">
                    {exam.grade.name} · {KIND_LABEL[exam.kind]}
                  </span>
                </span>

                <span className="shrink-0 text-xs font-semibold text-primary">
                  {/* The tile is hidden from screen readers, so the date is said here. */}
                  <span className="sr-only">{shortDay.format(date)}, </span>
                  {whenLabel(today, exam.heldOn)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default UpcomingExamsCard;
