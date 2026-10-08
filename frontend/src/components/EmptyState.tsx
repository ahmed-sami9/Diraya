import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  /** "success" is for good news, such as nothing being overdue. */
  tone?: 'primary' | 'success';
  /** Optional next step for the user. */
  action?: { label: string; to: string };
}

const toneClasses = {
  primary: 'bg-primary-tint text-primary',
  success: 'bg-success-tint text-success',
};

/** Shown inside a card when there is nothing to list yet. */
function EmptyState({ icon, title, description, tone = 'primary', action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-5 py-8 text-center">
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full ${toneClasses[tone]}`}
      >
        {icon}
      </span>

      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-ink-secondary">{description}</p>

      {action && (
        <Link
          to={action.to}
          className="
            mt-4 flex h-11 items-center
            rounded-[10px] border border-border bg-surface
            px-4 text-sm font-semibold text-ink
            transition-colors
            hover:bg-surface-hover
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
          "
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export default EmptyState;
