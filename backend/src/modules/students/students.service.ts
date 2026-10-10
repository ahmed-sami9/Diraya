import { isForeignKeyViolation } from '../../errors/pgErrors';

import { GradeErrors } from '../grades/grades.errors';
import { gradeExists } from '../grades/grades.repository';
import { GroupErrors } from '../groups/groups.errors';

import {
  findStudentsByGrade,
  insertStudentWithCode,
  searchStudentsByName,
  type GradeStudentRow,
} from './students.repository';
import type { StudentInput } from './students.validation';

// The dropdown shows at most this many. Enough to find someone by a partial
// name; if there are more, the teacher types another letter.
const SEARCH_RESULT_LIMIT = 8;

// What the API sends for each result. Matches StudentSearchResult on the frontend.
export type StudentSearchResult = {
  id: string;
  name: string;
  gradeName: string;
  groupName: string;
};

export async function searchStudents(
  teacherId: string,
  text: string
): Promise<StudentSearchResult[]> {
  const rows = await searchStudentsByName(teacherId, text, SEARCH_RESULT_LIMIT);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    gradeName: row.grade_name,
    groupName: row.group_name,
  }));
}

/* ------------------------- A grade's students ------------------------- */

export type PaymentStatus = 'paid' | 'partial' | 'unpaid';

// What the API sends for each student in a grade. Matches GradeStudent on
// the frontend.
//
// The last three are the table's quick summary, so a teacher can skim the
// whole grade without opening each profile:
//   attendanceRate  % of their group's sessions attended (0-100)
//   averageMark     average of their exam marks, as a % (0-100)
//   paymentStatus   this month's fee
export type GradeStudent = {
  id: string;
  code: string;
  name: string;
  groupId: string;
  joinedAt: string;
  attendanceRate: number | null;
  averageMark: number | null;
  paymentStatus: PaymentStatus | null;
};

// Attendance, exams and payments don't have tables yet, so the summary is
// always null ("no data yet") for now. The API shape is final: when those
// features land, only this function and its query change, not the frontend.
function toGradeStudent(row: GradeStudentRow): GradeStudent {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    groupId: row.group_id,
    joinedAt: row.joined_at.toISOString(),
    attendanceRate: null,
    averageMark: null,
    paymentStatus: null,
  };
}

export async function listGradeStudents(
  teacherId: string,
  gradeId: string
): Promise<GradeStudent[]> {
  // Checked first, so "this grade has no students" (an empty list) and
  // "this grade doesn't exist" (404) are told apart.
  if (!(await gradeExists(teacherId, gradeId))) throw GradeErrors.notFound();

  const rows = await findStudentsByGrade(teacherId, gradeId);

  return rows.map(toGradeStudent);
}

export async function addStudent(
  teacherId: string,
  gradeId: string,
  input: StudentInput
): Promise<GradeStudent> {
  let result: Awaited<ReturnType<typeof insertStudentWithCode>>;

  try {
    result = await insertStudentWithCode(teacherId, gradeId, input);
  } catch (error) {
    // The grade or group was deleted in the split second between the
    // check and the insert; the foreign key caught it.
    if (isForeignKeyViolation(error, 'students_grade_id_fkey')) throw GradeErrors.notFound();
    if (isForeignKeyViolation(error, 'students_group_in_grade_fkey')) throw GroupErrors.notFound();
    throw error;
  }

  if (result.status === 'grade-not-found') throw GradeErrors.notFound();
  if (result.status === 'group-not-found') throw GroupErrors.notFound();

  return toGradeStudent(result.student);
}
