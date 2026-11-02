import { useEffect, useState } from 'react';
import HamburgerIcon from '../../components/icons/HamburgerIcon';
import SearchIcon from '../../components/icons/SearchIcon';
import CloseIcon from '../../components/icons/CloseIcon';

import StudentSearch from './StudentSearch';

interface TeacherNavbarProps {
  teacherName: string;
  onOpenSidebar: () => void;
}

// Hours and dates on Egypt's clock, whatever the device's time zone says.
const cairoHour = new Intl.DateTimeFormat('en-GB', {
  hour: 'numeric',
  hourCycle: 'h23',
  timeZone: 'Africa/Cairo',
});

const getGreeting = (date: Date) => {
  const hour = Number(cairoHour.format(date));

  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

// "Monday, 5 October 2026"; phones get "Mon 5 Oct" so it fits.
const longDate = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Africa/Cairo',
});
const shortDate = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'Africa/Cairo',
});

// " Ahmed Sami " -> "Ahmed Sami" -> ["Ahmed", "Sami"] -> "Ahmed"
const getFirstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

function TeacherNavbar({ teacherName, onOpenSidebar }: TeacherNavbarProps) {
  // Re-read the clock every minute, so a tab left open overnight shows the new day.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Small screens only: the search opens as a full-width row in the card.
  const [isPhoneSearchOpen, setPhoneSearchOpen] = useState(false);

  const firstName = getFirstName(teacherName);

  return (
    // The outer strip is page-coloured, so content scrolling underneath
    // never shows through the gap around the card.
    <div className="z-20 bg-page px-4 pt-4 sm:px-6 lg:sticky lg:top-0 lg:px-8 lg:pt-6">
      {/* The same width as the page content below, so their edges line up. */}
      <header
        className="
          mx-auto flex min-h-[76px] w-full max-w-[1200px] flex-wrap items-center gap-3
          rounded-2xl border border-primary/15 bg-primary-tint
          px-4 py-3
          sm:px-6
        "
      >
        {/* Opens the sidebar drawer. Small screens only. */}
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open menu"
          className={`
            flex h-11 w-11 shrink-0 items-center justify-center
            rounded-[10px] text-ink-secondary
            hover:bg-surface
            lg:hidden
            ${focusRing}
          `}
        >
          <HamburgerIcon />
        </button>

        {/* Left: greeting and date */}
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-base font-semibold leading-tight text-ink sm:text-lg">
            {getGreeting(now)}
            {firstName && `, ${firstName}`}
          </p>
          <time
            dateTime={now.toISOString()}
            className="mt-0.5 truncate text-xs text-ink-secondary sm:text-[13px]"
          >
            <span className="sm:hidden">{shortDate.format(now).replace(',', '')}</span>
            <span className="hidden sm:inline">{longDate.format(now)}</span>
          </time>
        </div>

        {/* Right: student search, the one tool every page shares. Each
            page's own actions live on the page, next to what they change. */}
        <div className="flex shrink-0 items-center">
          {/* Always visible from tablet width up. */}
          <StudentSearch className="hidden w-72 md:block xl:w-80" />

          {/* On phones the search hides behind this button to save space. */}
          <button
            type="button"
            onClick={() => setPhoneSearchOpen((open) => !open)}
            aria-label={isPhoneSearchOpen ? 'Close search' : 'Search students'}
            aria-expanded={isPhoneSearchOpen}
            className={`
              flex h-11 w-11 items-center justify-center
              rounded-[10px] border border-primary/15 bg-surface text-ink-secondary
              transition-colors
              hover:bg-surface-hover
              md:hidden
              ${focusRing}
            `}
          >
            {isPhoneSearchOpen ? (
              <CloseIcon className="h-5 w-5" />
            ) : (
              <SearchIcon className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Phone search row: takes the full width under the greeting. */}
        {isPhoneSearchOpen && (
          <StudentSearch
            className="basis-full md:hidden"
            autoFocus
            onSelect={() => setPhoneSearchOpen(false)}
          />
        )}
      </header>
    </div>
  );
}

export default TeacherNavbar;
