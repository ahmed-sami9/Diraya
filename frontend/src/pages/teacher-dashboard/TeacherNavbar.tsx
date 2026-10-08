import { useState } from 'react';
import { Link } from 'react-router-dom';

import HamburgerIcon from '../../components/icons/HamburgerIcon';
import SearchIcon from '../../components/icons/SearchIcon';
import BellIcon from '../../components/icons/BellIcon';
import PlusIcon from '../../components/icons/PlusIcon';
import CloseIcon from '../../components/icons/CloseIcon';

import StudentSearch from './StudentSearch';

interface TeacherNavbarProps {
  teacherName: string;
  onOpenSidebar: () => void;
}

const getGreeting = (date: Date) => {
  const hour = date.getHours();

  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

// Example output: "Monday, 5 October 2026"
const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);

const getFirstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

function TeacherNavbar({ teacherName, onOpenSidebar }: TeacherNavbarProps) {
  // Read the clock once, when the dashboard loads.
  const [now] = useState(() => new Date());

  // Small screens only: the search opens as a full-width row in the card.
  const [isPhoneSearchOpen, setPhoneSearchOpen] = useState(false);

  const firstName = getFirstName(teacherName);

  return (
    // The outer strip is page-coloured, so content scrolling underneath
    // never shows through the gap around the card.
    <div className="z-20 bg-page px-4 pt-4 sm:px-6 lg:sticky lg:top-0 lg:px-8 lg:pt-6">
      <header
        className="
          flex min-h-[76px] flex-wrap items-center gap-3
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
            {formatDate(now)}
          </time>
        </div>

        {/* Right: search, notifications, main action */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Student search: always visible from tablet width up. */}
          <StudentSearch className="hidden w-56 md:block xl:w-64" />

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

          {/* TODO: notifications are not wired yet */}
          <button
            type="button"
            aria-label="Notifications"
            className={`
              flex h-11 w-11 items-center justify-center
              rounded-[10px] border border-primary/15 bg-surface text-ink-secondary
              transition-colors
              hover:bg-surface-hover
              ${focusRing}
            `}
          >
            <BellIcon className="h-5 w-5" />
          </button>

          <Link
            to="/teacher/exams"
            aria-label="Create quiz"
            className={`
              flex h-11 w-11 items-center justify-center gap-2
              rounded-[10px] bg-primary
              text-sm font-semibold text-white
              transition-colors
              hover:bg-primary-hover
              sm:w-auto sm:px-4
              ${focusRing}
            `}
          >
            <PlusIcon className="h-[18px] w-[18px]" />
            <span className="hidden sm:inline">Create quiz</span>
          </Link>
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
