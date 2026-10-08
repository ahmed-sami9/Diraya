import { useState } from 'react';

import HamburgerIcon from '../../components/icons/HamburgerIcon';

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

function TeacherNavbar({ teacherName, onOpenSidebar }: TeacherNavbarProps) {
  // Read the clock once, when the dashboard loads.
  const [now] = useState(() => new Date());

  const firstName = getFirstName(teacherName);

  return (
    <header
      className="
        sticky top-0 z-20
        flex h-16 items-center gap-3
        border-b border-border bg-surface
        px-4
        sm:px-6
        lg:px-8
      "
    >
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label="Open menu"
        className="
          flex h-11 w-11 shrink-0 items-center justify-center
          rounded-[10px] text-ink-secondary
          hover:bg-surface-hover
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
          lg:hidden
        "
      >
        <HamburgerIcon />
      </button>

      <div className="flex min-w-0 flex-col">
        <p className="truncate text-base font-bold leading-tight text-ink sm:text-lg">
          {getGreeting(now)}
          {firstName && `, ${firstName}`}
        </p>
        <time
          dateTime={now.toISOString()}
          className="truncate text-xs text-ink-secondary sm:text-sm"
        >
          {formatDate(now)}
        </time>
      </div>
    </header>
  );
}

export default TeacherNavbar;
