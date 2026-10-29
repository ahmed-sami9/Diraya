import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';

import Card from '../../../../components/Card';
import EmptyState from '../../../../components/EmptyState';
import ActivityIcon from '../../../../components/icons/ActivityIcon';
import CalendarIcon from '../../../../components/icons/CalendarIcon';
import ExamsIcon from '../../../../components/icons/ExamsIcon';
import PaymentsIcon from '../../../../components/icons/PaymentsIcon';
import PencilIcon from '../../../../components/icons/PencilIcon';
import UserPlusIcon from '../../../../components/icons/UserPlusIcon';
import { useActivity } from '../../../../hooks/activity/useActivity';
import { describeActivity, timeAgo, type ActivityKind } from '../../../../utils/activity';

// A side-column card: enough to see what happened lately.
const SHOWN = 6;

const KIND_STYLE: Record<ActivityKind, { icon: ComponentType<{ className?: string }>; tone: string }> = {
  student: { icon: UserPlusIcon, tone: 'bg-primary-tint text-primary' },
  payment: { icon: PaymentsIcon, tone: 'bg-success-tint text-success' },
  void: { icon: PaymentsIcon, tone: 'bg-danger-tint text-danger' },
  attendance: { icon: CalendarIcon, tone: 'bg-primary-tint text-primary' },
  exam: { icon: ExamsIcon, tone: 'bg-warning-tint text-warning' },
  marks: { icon: PencilIcon, tone: 'bg-warning-tint text-warning' },
  other: { icon: ActivityIcon, tone: 'bg-surface-hover text-ink-secondary' },
};

/**
 * What the teacher did lately, newest first. The backend writes each entry
 * inside the action itself; this card only reads them and words them
 * (utils/activity.ts). Each entry links to what it's about.
 */
function RecentActivityCard() {
  const { state, reload } = useActivity({ limit: SHOWN });

  return (
    <Card title="Recent activity">
      {state.status === 'loading' ? (
        <ul aria-hidden="true" className="divide-y divide-border">
          {[0, 1, 2].map((row) => (
            <li key={row} className="flex items-center gap-3 px-5 py-3.5">
              <span className="h-9 w-9 animate-pulse rounded-full bg-surface-hover" />
              <span className="h-4 flex-1 animate-pulse rounded bg-surface-hover" />
            </li>
          ))}
        </ul>
      ) : state.status === 'error' ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-5 py-5">
          <p className="text-sm text-ink-secondary">We couldn’t load your activity.</p>
          <button
            type="button"
            onClick={reload}
            className="flex h-10 cursor-pointer items-center rounded-[10px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-ink hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Try again
          </button>
        </div>
      ) : state.activity.length === 0 ? (
        <EmptyState
          icon={<ActivityIcon className="h-6 w-6" />}
          title="No activity yet"
          description="Adding students, recording payments, taking attendance and entering marks will show up here."
        />
      ) : (
        <ul className="divide-y divide-border">
          {state.activity.map((entry) => {
            const { kind, title, detail, to } = describeActivity(entry);
            const { icon: Icon, tone } = KIND_STYLE[kind];

            const content = (
              <>
                <span
                  aria-hidden="true"
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{title}</span>
                    <time
                      dateTime={entry.createdAt}
                      className="shrink-0 text-xs text-ink-muted"
                    >
                      {timeAgo(entry.createdAt)}
                    </time>
                  </span>
                  {detail && (
                    <span className="line-clamp-2 text-[13px] text-ink-secondary">{detail}</span>
                  )}
                </span>
              </>
            );

            return (
              <li key={entry.id}>
                {to ? (
                  <Link
                    to={to}
                    className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 px-5 py-3.5">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export default RecentActivityCard;
