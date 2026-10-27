import type { TodayClass } from '../../../api/home/home';

// Opens one class's attendance sheet: /teacher/attendance?groupId=6&date=2026-10-27
export const attendanceLink = (groupId: string, date: string) =>
  `/teacher/attendance?groupId=${encodeURIComponent(groupId)}&date=${date}`;

export type TodayProgress = {
  total: number;
  taken: number;
  // The earliest class still waiting for attendance (even one that already
  // started: it still needs taking). null when every class is done.
  next: TodayClass | null;
};

// Shared by the Attendance tile and the Today's schedule card, so both
// always agree on which class comes next. Expects the server's order.
export function todayProgress(classes: TodayClass[]): TodayProgress {
  return {
    total: classes.length,
    taken: classes.filter((item) => item.taken).length,
    next: classes.find((item) => !item.taken) ?? null,
  };
}
