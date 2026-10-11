import { NavLink } from 'react-router-dom';

// Each tab is its own URL (/teacher/students/42/attendance), so refresh, the
// Back button and a pasted link all open the right tab.
//
// Because they are links to pages, they are a <nav> with aria-current, NOT
// ARIA tabs (role="tab" promises panels on the same page, switched with the
// arrow keys). NavLink sets aria-current="page" on the active one by itself.
//
// `to` is relative to the profile route: '' is the profile itself.
const TABS = [
  { to: '', label: 'Overview', end: true },
  { to: 'attendance', label: 'Attendance', end: false },
  { to: 'marks', label: 'Exams & marks', end: false },
  { to: 'payments', label: 'Payments', end: false },
  { to: 'notes', label: 'Notes', end: false },
];

function ProfileTabs() {
  return (
    <nav
      aria-label="Student profile"
      // Scrolls sideways on phones instead of wrapping onto two lines.
      className="overflow-x-auto border-b border-border-strong"
    >
      <ul className="flex gap-1">
        {TABS.map(({ to, label, end }) => (
          <li key={label}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) => `
                -mb-px flex h-11 items-center whitespace-nowrap border-b-[3px] px-4
                text-sm transition-colors
                focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary
                ${
                  isActive
                    ? 'border-primary font-bold text-primary'
                    : 'border-transparent font-semibold text-ink-secondary hover:text-ink'
                }
              `}
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default ProfileTabs;
