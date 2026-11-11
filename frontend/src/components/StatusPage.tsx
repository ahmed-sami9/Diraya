import { Link } from 'react-router-dom';

import DirayaMark from './DirayaMark';
import { primaryButtonClasses } from './formStyles';

type StatusPageProps = {
  code: string;
  title: string;
  message: string;
};

// A full page for "this address can't be shown" (404, wrong role). Since the
// host answers every path with the app, the app has to say "not found" itself.
function StatusPage({ code, title, message }: StatusPageProps) {
  return (
    <main className="relative flex min-h-screen w-full flex-col bg-page">
      <header className="absolute left-6 top-6 sm:left-10 sm:top-8 lg:left-14 lg:top-10">
        <Link
          to="/teacher"
          className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <DirayaMark className="h-10 w-10 text-primary-solid dark:text-white" />
          <span className="text-lg font-bold text-ink sm:text-xl">Diraya</span>
        </Link>
      </header>

      <section className="flex flex-1 items-center justify-center px-5 pb-10 pt-28">
        <div className="flex max-w-[460px] flex-col items-center text-center">
          {/* Decoration: the heading below says the same in words. */}
          <p
            aria-hidden="true"
            className="text-7xl font-bold tracking-tight text-primary/25 sm:text-8xl"
          >
            {code}
          </p>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-secondary sm:text-base">
            {message}
          </p>
          <Link
            to="/teacher"
            className={`${primaryButtonClasses} mt-8 inline-flex items-center`}
          >
            Go to Overview
          </Link>
        </div>
      </section>
    </main>
  );
}

export default StatusPage;
