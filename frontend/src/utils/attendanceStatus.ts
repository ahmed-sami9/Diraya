import type { AttendanceStatus } from '../api/students/profile';

// How each attendance status looks, everywhere it appears (the profile's
// squares, the Take attendance sheet...). One place, so a status never means
// one colour on one page and another elsewhere.
//
// Each has a symbol as well as a colour: red and green look alike to
// colour-blind teachers, so the symbol carries the meaning.
export const ATTENDANCE_STATUS: Record<
  AttendanceStatus,
  { label: string; symbol: string; classes: string }
> = {
  present: { label: 'Present', symbol: '✓', classes: 'bg-success text-surface' },
  late: { label: 'Late', symbol: 'L', classes: 'bg-warning-tint text-warning' },
  absent: {
    label: 'Absent',
    symbol: '✕',
    classes: 'border-2 border-danger bg-surface text-danger',
  },
  excused: { label: 'Excused', symbol: 'E', classes: 'bg-primary-tint text-primary' },
};

// Statuses that count as "came to class" (a late student still came).
export const ATTENDED: readonly AttendanceStatus[] = ['present', 'late'];
