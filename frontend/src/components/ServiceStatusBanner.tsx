import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useRetry } from '../hooks/useRetry';

import AlertTriangleIcon from './icons/AlertTriangleIcon';

type ServiceStatusBannerProps = {
  // Asks the server again. Resolves to true when it answered.
  onRetry: () => Promise<boolean>;
};

// A slim notice floating at the bottom of public pages (sign-in, sign-up)
// while the server can't be reached.
//
// Those pages are still useful without the server: the person can read them
// and fill in the form. So instead of hiding the page behind a full-screen
// error, this explains why signing in may fail, and goes away by itself once
// the server answers.
function ServiceStatusBanner({ onRetry }: ServiceStatusBannerProps) {
  const isOnline = useOnlineStatus();
  const { isRetrying, retry } = useRetry(onRetry);

  const message = isOnline
    ? 'Diraya isn’t responding right now, so signing in may not work yet.'
    : 'You’re offline. Signing in will work once you’re back online.';

  return (
    <div
      role="status"
      className="
        fixed inset-x-0 bottom-4 z-50
        mx-auto flex w-[calc(100%-2rem)] max-w-[560px] items-center gap-3
        rounded-xl border border-warning/25 bg-warning-tint
        px-4 py-3
        shadow-lg shadow-ink/10
      "
    >
      <AlertTriangleIcon className="h-5 w-5 shrink-0 text-warning" />

      <p className="flex-1 text-sm font-medium leading-snug text-warning">{message}</p>

      <button
        type="button"
        onClick={retry}
        disabled={isRetrying}
        className="
          shrink-0 rounded-lg px-2.5 py-1.5
          text-sm font-semibold text-warning underline-offset-2
          cursor-pointer
          hover:underline
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning
          disabled:cursor-wait disabled:opacity-70
        "
      >
        {isRetrying ? 'Trying…' : 'Retry'}
      </button>
    </div>
  );
}

export default ServiceStatusBanner;
