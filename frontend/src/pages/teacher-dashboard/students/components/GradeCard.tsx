import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import type { GradeSummary } from '../../../../api/students/grades';
import CalendarIcon from '../../../../components/icons/CalendarIcon';
import CheckCircleIcon from '../../../../components/icons/CheckCircleIcon';
import AlertTriangleIcon from '../../../../components/icons/AlertTriangleIcon';
import { getSessionLabel, isLowAttendance, pluralize } from '../../../../utils/formatSession';

import GradeOptionsMenu from './GradeOptionsMenu';

interface GradeCardProps {
  grade: GradeSummary;
  onEdit: () => void;
  onDelete: () => void;
}

// Each colour has one meaning across the dashboard:
//   blue  = upcoming session
//   green = healthy attendance, amber = low attendance
//   grey  = nothing yet
const chipTones = {
  upcoming: 'bg-info-tint text-info',
  good: 'bg-success-tint text-success',
  low: 'bg-warning-tint text-warning',
  none: 'bg-surface-hover text-ink-muted',
};

interface SessionRowProps {
  label: string;
  tone: keyof typeof chipTones;
  icon: ReactNode;
  children: ReactNode;
}

function SessionRow({ label, tone, icon, children }: SessionRowProps) {
  return (
    <div className="flex gap-2.5">
      <span
        aria-hidden="true"
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${chipTones[tone]}`}
      >
        {icon}
      </span>

      <span className="flex min-w-0 flex-col">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        {children}
      </span>
    </div>
  );
}

// One grade on the Students page: its name, size, and its next and last
// sessions. The whole card opens the grade.
function GradeCard({ grade, onEdit, onDelete }: GradeCardProps) {
  const { nextSession, lastSession } = grade;

  const next = nextSession ? getSessionLabel(nextSession.startsAt) : null;
  const last = lastSession ? getSessionLabel(lastSession.heldAt) : null;
  const isLow = lastSession
    ? isLowAttendance(lastSession.presentCount, lastSession.totalCount)
    : false;

  const iconClasses = 'h-4 w-4';

  return (
    <article
      className="
        relative flex flex-col gap-4
        rounded-[14px] border border-border bg-surface
        px-6 py-[22px]
        transition-colors
        hover:border-primary/30
      "
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-[21px] font-bold leading-tight text-ink">
            {/* The link's ::after stretches over the whole card, so the card
                is clickable while the HTML stays valid: a link can't contain
                the options button, so the button sits on top instead. */}
            <Link
              to={`/teacher/students/grades/${grade.id}`}
              className="
                after:absolute after:inset-0 after:rounded-[14px]
                hover:text-primary
                focus-visible:outline-none
                focus-visible:after:outline-2 focus-visible:after:outline-offset-2
                focus-visible:after:outline-primary
              "
            >
              {grade.name}
            </Link>
          </h2>

          <p className="text-sm font-medium text-ink-secondary">
            {pluralize(grade.studentCount, 'student')} · {pluralize(grade.groupCount, 'group')}
          </p>
        </div>

        <GradeOptionsMenu
          gradeName={grade.name}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>

      <div className="flex flex-col gap-2.5 border-t border-border pt-4">
        <SessionRow
          label="Next session"
          tone={next ? 'upcoming' : 'none'}
          icon={<CalendarIcon className={iconClasses} />}
        >
          {next && nextSession ? (
            <span className="text-[15px] font-semibold text-ink">
              <span className={next.isToday ? 'text-primary' : undefined}>{next.day}</span>,{' '}
              {next.time} · {nextSession.groupName}
            </span>
          ) : (
            <span className="text-[15px] font-medium text-ink-secondary">
              No sessions scheduled
            </span>
          )}
        </SessionRow>

        <SessionRow
          label="Last session"
          tone={last ? (isLow ? 'low' : 'good') : 'none'}
          icon={
            isLow ? (
              <AlertTriangleIcon className={iconClasses} />
            ) : (
              <CheckCircleIcon className={iconClasses} />
            )
          }
        >
          {last && lastSession ? (
            <span className="text-[15px] font-semibold text-ink">
              {last.day} · {lastSession.presentCount} of {lastSession.totalCount} present
              {/* Colour alone can't carry meaning, so low attendance is also said in words. */}
              {isLow && <span className="sr-only"> (low attendance)</span>}
            </span>
          ) : (
            <span className="text-[15px] font-medium text-ink-secondary">No sessions yet</span>
          )}
        </SessionRow>
      </div>
    </article>
  );
}

export default GradeCard;
