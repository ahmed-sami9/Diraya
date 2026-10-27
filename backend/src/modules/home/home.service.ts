import { getStudentCounts, type StudentCounts } from '../students/students.service';

// Everything the Home page shows, in one answer. This module owns no rules:
// each number comes from the module that owns that data, so a tile can never
// disagree with the page it links to. More tiles add more keys here.
export type HomeSummary = {
  students: StudentCounts;
};

export async function getHomeSummary(teacherId: string): Promise<HomeSummary> {
  const students = await getStudentCounts(teacherId);

  return { students };
}
