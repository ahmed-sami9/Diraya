import { isForeignKeyViolation } from '../../errors/pgErrors';
import { currentMonthInCairo } from '../../utils/cairoDate';

import { toAttendanceRate } from '../attendance/attendance.rules';

import { GradeErrors } from '../grades/grades.errors';
import { gradeExists } from '../grades/grades.repository';
import { GroupErrors } from '../groups/groups.errors';
import type { MonthStatus } from '../payments/payments.repository';

import {
  countStudents,
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

// The payments page's own statuses, so both pages use the same words.
export type PaymentStatus = MonthStatus;

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

// The mark is rounded here, like the profile's average, so both show the
// same whole percent.
function toGradeStudent(row: GradeStudentRow): GradeStudent {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    groupId: row.group_id,
    joinedAt: row.joined_at.toISOString(),
    attendanceRate: toAttendanceRate(row.attended, row.attendance_total),
    averageMark: row.average_mark === null ? null : Math.round(row.average_mark),
    paymentStatus: row.payment_status,
  };
}

export async function listGradeStudents(
  teacherId: string,
  gradeId: string
): Promise<GradeStudent[]> {
  // Checked first, so "this grade has no students" (an empty list) and
  // "this grade doesn't exist" (404) are told apart.
  if (!(await gradeExists(teacherId, gradeId))) throw GradeErrors.notFound();

  const rows = await findStudentsByGrade(teacherId, gradeId, currentMonthInCairo());

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

  // Read back with the table's own query, so the new row shows this month's
  // fee like the others. The insert's row is the fallback.
  const [row] = await findStudentsByGrade(
    teacherId,
    gradeId,
    currentMonthInCairo(),
    result.student.id
  );

  return toGradeStudent(row ?? result.student);
}

/* ------------------------------ Home summary ------------------------------ */

export type StudentCounts = {
  total: number;
  joinedThisMonth: number;
};

// "This month" is the month in Egypt, the same calendar payments use.
export async function getStudentCounts(teacherId: string): Promise<StudentCounts> {
  const counts = await countStudents(teacherId, currentMonthInCairo());

  return { total: counts.total, joinedThisMonth: counts.joined_in_month };
}
