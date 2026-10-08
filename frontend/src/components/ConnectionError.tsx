import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useRetry } from '../hooks/useRetry';
import { CONNECTION_COPY } from '../utils/connectionProblem';

import RefreshIcon from './icons/RefreshIcon';

type ConnectionErrorProps = {
  // Asks the server again. Resolves to true when it answered.
  onRetry: () => Promise<boolean>;
};

// The full-page error. Only for when the app can't work at all: we couldn't
// ask the server who is signed in, so there is nothing safe to show.
// (When only one part of a page fails, SectionError is used instead.)
//
// It tells apart "you're offline" from "our server isn't answering", because
// the two need different advice. When the device comes back online, the
// session is checked again automatically (see AuthContext), so this screen
// clears itself.
function ConnectionError({ onRetry }: ConnectionErrorProps) {
  const isOnline = useOnlineStatus();
  const { isRetrying, stillFailing, retry } = useRetry(onRetry);

  const copy = isOnline ? CONNECTION_COPY.server : CONNECTION_COPY.offline;

  return (
    <main className="relative flex min-h-screen w-full flex-col overflow-hidden bg-page">
      {/* Brand. A label, not a heading: the heading is the message below. */}
      <header className="absolute left-6 top-6 sm:left-10 sm:top-8 lg:left-14 lg:top-10">
        <div className="flex items-center gap-3">
          {/* Dark mark on the light theme, light mark on the dark theme. */}
          <img
            src="/diraya-logo-dark.png"
            alt=""
            className="h-auto w-10 dark:hidden sm:w-11"
          />
          <img
            src="/diraya-logo-light.png"
            alt=""
            className="hidden h-auto w-10 dark:block sm:w-11"
          />

          <div>
            <p className="text-lg font-bold leading-tight text-ink sm:text-xl">Diraya</p>
            <p className="mt-0.5 text-xs text-ink-muted">Educational Management System</p>
          </div>
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-5 pb-10 pt-28">
        <div className="flex w-full max-w-[640px] flex-col items-center text-center">
          {/* width/height stop the text jumping down when the image loads. */}
          <img
            src="/disconnected-illustration.webp"
            alt=""
            width={1040}
            height={620}
            draggable={false}
            className="h-auto w-[82%] max-w-[420px] select-none sm:max-w-[460px]"
          />

          {/* role="alert" makes screen readers announce the problem. */}
          <div role="alert">
            <h1 className="mt-6 text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-3xl lg:text-[34px]">
              {copy.title}
            </h1>

            <p className="mx-auto mt-3 max-w-[460px] text-[15px] leading-relaxed text-ink-secondary sm:text-base">
              {copy.message}
            </p>
          </div>

          <button
            type="button"
            onClick={retry}
            disabled={isRetrying}
            aria-busy={isRetrying}
            className="
              mt-8 flex h-12 min-w-[180px] items-center justify-center gap-2.5
              rounded-xl bg-primary px-7
              text-[15px] font-semibold text-white
              shadow-sm
              cursor-pointer
              transition-colors
              hover:bg-primary-hover
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
              disabled:cursor-wait disabled:opacity-80
            "
          >
            <RefreshIcon
              className={`h-5 w-5 ${isRetrying ? 'animate-spin motion-reduce:animate-none' : ''}`}
            />
            {isRetrying ? 'Trying…' : 'Try again'}
          </button>

          {/* Says the click did something, even when the answer is "not yet". */}
          <p
            aria-live="polite"
            className="mt-4 min-h-5 text-sm text-ink-muted"
          >
            {stillFailing && 'Still no answer. Please try again in a little while.'}
          </p>
        </div>
      </section>
    </main>
  );
}

export default ConnectionError;
