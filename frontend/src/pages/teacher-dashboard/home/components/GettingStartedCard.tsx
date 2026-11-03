import { Link } from 'react-router-dom';

import CheckCircleIcon from '../../../../components/icons/CheckCircleIcon';
import ChevronRightIcon from '../../../../components/icons/ChevronRightIcon';

export type SetupDone = { students: boolean; exam: boolean; payment: boolean };

const steps: { key: keyof SetupDone; to: string; title: string; description: string }[] = [
  {
    key: 'students',
    to: '/teacher/students',
    title: 'Add your first student',
    description: 'Students are the starting point for attendance, marks and payments.',
  },
  {
    key: 'exam',
    to: '/teacher/exams',
    title: 'Create your first quiz',
    description: 'Set the questions once, then record marks for each student.',
  },
  {
    key: 'payment',
    to: '/teacher/payments',
    title: 'Record a payment',
    description: 'Keep track of who has paid and who is behind.',
  },
];

/**
 * The first thing a new teacher sees: three steps to get the workspace ready.
 * Finished steps show a check; the page hides the card once all three are done.
 */
function GettingStartedCard({ done }: { done: SetupDone }) {
  return (
    <section className="rounded-[14px] border border-primary/15 bg-surface">
      <div className="px-5 pb-4 pt-5">
        <h2 className="text-[17px] font-bold text-ink">Set up your workspace</h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Three steps to get Diraya ready for your classes.
        </p>
      </div>

      <ol>
        {steps.map(({ key, to, title, description }, index) => (
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
                className={`
                  flex h-9 w-9 shrink-0 items-center justify-center
                  rounded-full text-sm font-bold
                  ${done[key] ? 'bg-success-tint text-success' : 'bg-primary-tint text-primary'}
                `}
              >
                {done[key] ? <CheckCircleIcon className="h-[18px] w-[18px]" /> : index + 1}
              </span>

              <span className="flex min-w-0 flex-1 flex-col">
                <span
                  className={`text-sm font-semibold ${done[key] ? 'text-ink-muted line-through' : 'text-ink'}`}
                >
                  {title}
                  {done[key] && <span className="sr-only"> (done)</span>}
                </span>
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
