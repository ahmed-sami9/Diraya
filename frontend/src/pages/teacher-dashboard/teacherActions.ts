import type { ComponentType } from 'react';

import CheckCircleIcon from '../../components/icons/CheckCircleIcon';
import ExamsIcon from '../../components/icons/ExamsIcon';
import PaymentsIcon from '../../components/icons/PaymentsIcon';
import PlusIcon from '../../components/icons/PlusIcon';
import UserPlusIcon from '../../components/icons/UserPlusIcon';

export type IconComponent = ComponentType<{ className?: string }>;

export type TeacherAction = {
  label: string;
  icon: IconComponent;
  to: string;
};

// Every action a teacher can start from a shortcut, defined ONCE.
//
// The navbar's main button and the Home page's quick actions both read from
// this list, so a label or a destination changes in one place only.
//
// `satisfies` checks each entry against TeacherAction while keeping the exact
// keys, so `teacherActions.addExam` autocompletes and a typo is an error.
export const teacherActions = {
  takeAttendance: {
    label: 'Take attendance',
    icon: CheckCircleIcon,
    to: '/teacher/attendance',
  },
  addStudent: {
    label: 'Add student',
    icon: UserPlusIcon,
    to: '/teacher/students',
  },
  addExam: {
    label: 'Add exam',
    icon: PlusIcon,
    to: '/teacher/exams',
  },
  recordMarks: {
    label: 'Record marks',
    icon: ExamsIcon,
    to: '/teacher/exams',
  },
  recordPayment: {
    label: 'Record payment',
    icon: PaymentsIcon,
    to: '/teacher/payments',
  },
} satisfies Record<string, TeacherAction>;

// The navbar button for any section that doesn't name its own action.
// Attendance is what a teacher does most, so it is the safe default.
export const DEFAULT_PRIMARY_ACTION: TeacherAction = teacherActions.takeAttendance;
