import { NavLink, useLocation } from 'react-router-dom';

import {
  HomeIcon,
  StudentsIcon,
  ExamsIcon,
  PaymentsIcon,
  SettingsIcon,
  LogoutIcon,
  CloseIcon,
} from '../../components/icons/index.ts';

interface TeacherSidebarProps {
  /** Small screens only: whether the drawer is open. Ignored from lg up. */
  isOpen: boolean;
  onClose: () => void;
  teacherName: string;
  teacherRole: string;
  onLogout: () => void;
}

// The single source of truth for the sidebar. Add a page here and in App.tsx.
const navItems = [
  { to: '/teacher', label: 'Home', icon: HomeIcon, end: true },
  { to: '/teacher/students', label: 'Students', icon: StudentsIcon, end: false },
  { to: '/teacher/exams', label: 'Exams & Marks', icon: ExamsIcon, end: false },
  { to: '/teacher/payments', label: 'Payments', icon: PaymentsIcon, end: false },
  { to: '/teacher/settings', label: 'Settings', icon: SettingsIcon, end: false },
];

// Each link is 44px tall (h-11) with a 4px gap (gap-1). The sliding highlight
// relies on these two numbers, so change them together with the classes.
const NAV_ITEM_HEIGHT = 44;
const NAV_ITEM_GAP = 4;

const getActiveIndex = (pathname: string) =>
  navItems.findIndex(({ to, end }) =>
    end
      ? pathname === to || pathname === `${to}/`
      : pathname === to || pathname.startsWith(`${to}/`)
  );

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

function TeacherSidebar({
  isOpen,
  onClose,
  teacherName,
  teacherRole,
  onLogout,
}: TeacherSidebarProps) {
  const { pathname } = useLocation();
  const activeIndex = getActiveIndex(pathname);

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-40
        flex w-64 flex-col gap-7
        bg-sidebar px-4 py-6
        transition-[translate,visibility,box-shadow]
        will-change-transform
        motion-reduce:transition-none

        lg:visible lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none

        ${
          isOpen
            ? 'visible translate-x-0 shadow-2xl duration-300 ease-out'
            : 'invisible -translate-x-full duration-200 ease-in'
        }
      `}
    >
      <div className="flex items-center justify-between gap-2 px-2">
        <NavLink
          to="/teacher"
          end
          onClick={onClose}
          className={`flex items-center gap-3 rounded-md text-white ${focusRing}`}
        >
          <img
            src="/diraya-logo-light.png"
            alt=""
            className="h-9 w-auto"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-xl font-bold leading-none">Diraya</span>
            <span className="text-[11px] leading-tight text-white/70">
              Educational Management System
            </span>
          </span>
        </NavLink>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className={`
            flex h-11 w-11 shrink-0 items-center justify-center
            rounded-[10px] text-white/70
            hover:bg-white/10 hover:text-white
            lg:hidden
            ${focusRing}
          `}
        >
          <CloseIcon />
        </button>
      </div>

      <nav
        aria-label="Main"
        className="relative flex flex-col gap-1"
      >
        {/* Sliding highlight: one pill that glides to the active link */}
        <span
          aria-hidden="true"
          style={{
            transform: `translateY(${Math.max(activeIndex, 0) * (NAV_ITEM_HEIGHT + NAV_ITEM_GAP)}px)`,
          }}
          className={`
            absolute inset-x-0 top-0 h-11
            rounded-[10px] bg-primary
            shadow-lg shadow-black/20
            transition-[transform,opacity] duration-300 ease-out
            motion-reduce:transition-none
            ${activeIndex === -1 ? 'opacity-0' : 'opacity-100'}
          `}
        />

        {navItems.map(({ to, label, icon: ItemIcon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) => `
              group relative z-10
              flex h-11 items-center gap-3
              rounded-[10px] px-3
              text-sm
              transition-[color,background-color,transform] duration-200
              active:scale-[0.98]
              ${focusRing}
              ${
                isActive
                  ? 'font-semibold text-white'
                  : 'font-medium text-white/70 hover:bg-white/10 hover:text-white'
              }
            `}
          >
            <ItemIcon className="h-5 w-5 transition-transform duration-200 group-hover:scale-110 motion-reduce:transition-none" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 border-t border-white/15 px-2 pt-3">
        <span
          aria-hidden="true"
          className="
            flex h-[38px] w-[38px] shrink-0 items-center justify-center
            rounded-full bg-white/15
            text-sm font-bold text-white
          "
        >
          {getInitials(teacherName)}
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-white">{teacherName}</span>
          <span className="truncate text-xs text-white/70">{teacherRole}</span>
        </span>

        <button
          type="button"
          onClick={onLogout}
          aria-label="Log out"
          className={`
            flex h-11 w-11 shrink-0 items-center justify-center
            rounded-[10px] text-white/70
            transition-colors
            hover:bg-white/10 hover:text-white
            ${focusRing}
          `}
        >
          <LogoutIcon />
        </button>
      </div>
    </aside>
  );
}

export default TeacherSidebar;
