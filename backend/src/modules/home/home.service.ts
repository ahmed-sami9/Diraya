import { getClassesToday, type ScheduledClass } from '../attendance/attendance.service';
import { getStudentCounts, type StudentCounts } from '../students/students.service';

// Everything the Home page shows, in one answer. This module owns no rules:
// each number comes from the module that owns that data, so a tile can never
// disagree with the page it links to. More tiles add more keys here.
export type HomeSummary = {
  students: StudentCounts;
  // Today's classes from the groups' timetables (Egypt's day), earliest first.
  classesToday: { date: string; classes: ScheduledClass[] };
};

export async function getHomeSummary(teacherId: string): Promise<HomeSummary> {
  // Independent reads: run them at the same time.
  const [students, classesToday] = await Promise.all([
    getStudentCounts(teacherId),
    getClassesToday(teacherId),
  ]);

  return { students, classesToday };
}
