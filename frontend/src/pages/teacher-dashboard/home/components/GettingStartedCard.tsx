import { Link } from 'react-router-dom';

import ChevronRightIcon from '../../../../components/icons/ChevronRightIcon';

const steps = [
  {
    to: '/teacher/students',
    title: 'Add your first student',
    description: 'Students are the starting point for attendance, marks and payments.',
  },
  {
    to: '/teacher/exams',
    title: 'Create your first quiz',
    description: 'Set the questions once, then record marks for each student.',
  },
  {
    to: '/teacher/payments',
    title: 'Record a payment',
    description: 'Keep track of who has paid and who is behind.',
  },
];

/** The first thing a new teacher sees: three steps to get the workspace ready. */
function GettingStartedCard() {
  return (
    <section className="rounded-[14px] border border-primary/15 bg-surface">
      <div className="px-5 pb-4 pt-5">
        <h2 className="text-[17px] font-bold text-ink">Set up your workspace</h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Three steps to get Diraya ready for your classes.
        </p>
      </div>

      <ol>
        {steps.map(({ to, title, description }, index) => (
          <li
            key={to}
            className="border-t border-border"
          >
            <Link
              to={to}
              className="
                group flex items-center gap-4
                px-5 py-4
                transition-colors
                hover:bg-surface-hover
                focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary
              "
            >
              <span
                aria-hidden="true"
                className="
                  flex h-9 w-9 shrink-0 items-center justify-center
                  rounded-full bg-primary-tint
                  text-sm font-bold text-primary
                "
              >
                {index + 1}
              </span>

              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold text-ink">{title}</span>
                <span className="text-[13px] text-ink-secondary">{description}</span>
              </span>

              <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default GettingStartedCard;
