import {
  HomeIcon,
  StudentsIcon,
  ExamsIcon,
  PaymentsIcon,
  NotesIcon,
  SettingsIcon,
} from '../../components/icons/index.ts';

import type { IconComponent } from './teacherActions';

export type NavItem = {
  to: string;
  label: string;
  icon: IconComponent;
  /** true: active only on this exact path. false: also on the paths below it. */
  end: boolean;
};

// The single source of truth for the dashboard's sections: the sidebar draws
// its links from it.
//
// Add a page here and in App.tsx.
export const navItems: NavItem[] = [
  { to: '/teacher', label: 'Overview', icon: HomeIcon, end: true },
  { to: '/teacher/students', label: 'Students', icon: StudentsIcon, end: false },
  { to: '/teacher/exams', label: 'Exams & Marks', icon: ExamsIcon, end: false },
  { to: '/teacher/payments', label: 'Payments', icon: PaymentsIcon, end: false },
  { to: '/teacher/notes', label: 'My notes', icon: NotesIcon, end: false },
  { to: '/teacher/settings', label: 'Settings', icon: SettingsIcon, end: false },
];

// Which section the URL is in, or -1 for none (an attendance page, for
// example). Derived from the URL, never stored: refresh, the back button and
// a pasted link all give the right answer with no syncing.
export const getActiveIndex = (pathname: string) =>
  navItems.findIndex(({ to, end }) =>
    end
      ? pathname === to || pathname === `${to}/`
      : pathname === to || pathname.startsWith(`${to}/`)
  );
