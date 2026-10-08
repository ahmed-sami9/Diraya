import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { CONNECTION_COPY, getConnectionProblem } from '../utils/connectionProblem';

import RefreshIcon from './icons/RefreshIcon';

type SectionErrorProps = {
  // What failed, in the words of the place it's used:
  // "We couldn't load your grades", "We couldn't load this student"...
  title: string;
  // The error that was caught. It decides the explanation under the title.
  error: unknown;
  onRetry: () => void;
};

// The error shown INSIDE a page, when one part of it couldn't load. The
// sidebar, navbar and everything else keep working; only this box failed.
//
// Same cloud as the full-page error, smaller, so both read as one family:
// big cloud = the app is down, small cloud = this part is down.
function SectionError({ title, error, onRetry }: SectionErrorProps) {
  const isOnline = useOnlineStatus();
  const problem = getConnectionProblem(error, isOnline);

  const message =
    problem === 'other'
      ? error instanceof Error
        ? error.message
        : 'Something went wrong. Please try again.'
      : CONNECTION_COPY[problem].message;

  return (
    <section
      role="alert"
      className="
        flex flex-col items-center
        rounded-[14px] border border-border bg-surface
        px-6 pb-9 pt-7 text-center
      "
    >
      <img
        src="/disconnected-illustration-small.webp"
        alt=""
        width={360}
        height={280}
        draggable={false}
        className="h-auto w-[150px] select-none sm:w-[170px]"
      />

      <h2 className="mt-3 text-lg font-bold text-ink">{title}</h2>

      {/* Offline is the person's to fix, so say it first and plainly. */}
      {problem === 'offline' && (
        <p className="mt-1 text-sm font-semibold text-ink">{CONNECTION_COPY.offline.title}</p>
      )}

      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-secondary">{message}</p>

      <button
        type="button"
        onClick={onRetry}
        className="
          mt-5 flex h-11 items-center gap-2
          rounded-[10px] border border-border bg-surface px-[18px]
          text-sm font-semibold text-ink
          cursor-pointer
          transition-colors
          hover:bg-surface-hover
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
        "
      >
        <RefreshIcon className="h-4 w-4 text-ink-secondary" />
        Try again
      </button>
    </section>
  );
}

export default SectionError;
