import { useLocation } from 'react-router-dom';

import {
  HomeIcon,
  StudentsIcon,
  ExamsIcon,
  PaymentsIcon,
  SettingsIcon,
} from '../../components/icons/index.ts';

import { teacherActions, type IconComponent, type TeacherAction } from './teacherActions';

export type NavItem = {
  to: string;
  label: string;
  icon: IconComponent;
  /** true: active only on this exact path. false: also on the paths below it. */
  end: boolean;
  /** The navbar's main button in this section. Missing: the default action. */
  primaryAction?: TeacherAction;
};

// The single source of truth for the dashboard's sections. The sidebar draws
// its links from it and the navbar picks its main button from it, so the two
// can never disagree about where the teacher is.
//
// Add a page here and in App.tsx.
export const navItems: NavItem[] = [
  { to: '/teacher', label: 'Home', icon: HomeIcon, end: true },
  { to: '/teacher/students', label: 'Students', icon: StudentsIcon, end: false },
  {
    to: '/teacher/exams',
    label: 'Exams & Marks',
    icon: ExamsIcon,
    end: false,
    primaryAction: teacherActions.addExam,
  },
  {
    to: '/teacher/payments',
    label: 'Payments',
    icon: PaymentsIcon,
    end: false,
    primaryAction: teacherActions.recordPayment,
  },
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

/** The section the teacher is in now, or null outside every section. */
export function useActiveNavItem(): NavItem | null {
  const { pathname } = useLocation();

  return navItems[getActiveIndex(pathname)] ?? null;
}
