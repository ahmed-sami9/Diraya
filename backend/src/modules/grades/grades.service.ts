import { isForeignKeyViolation, isUniqueViolation } from '../../errors/pgErrors';

import { listGroups, type GroupSummary } from '../groups/groups.service';

import { GradeErrors } from './grades.errors';
import type { GradeInput } from './grades.validation';
import {
  deleteGradeWithoutStudents,
  findGradeById,
  findGradesByTeacher,
  gradeExists,
  insertGradeWithFirstGroup,
  updateGrade,
  type GradeRow,
} from './grades.repository';

// Names of database rules this service translates into clear errors. They
// must match the migrations (create-grades, create-students).
const NAME_UNIQUE_INDEX = 'grades_teacher_id_name_unique';
const STUDENT_GRADE_FOREIGN_KEY = 'students_grade_id_fkey';
const STUDENT_GROUP_FOREIGN_KEY = 'students_group_in_grade_fkey';

// The group every new grade starts with. A teacher with one class per grade
// never has to think about groups; one with several renames it and adds more.
const FIRST_GROUP_NAME = 'Group 1';

// What the API sends for each grade. Matches GradeSummary on the frontend.
export type GradeSummary = {
  id: string;
  name: string;
  monthlyFee: number | null;
  studentCount: number;
  groupCount: number;
  nextSession: { startsAt: string; groupName: string } | null;
  lastSession: {
    heldAt: string;
    groupName: string;
    presentCount: number;
    totalCount: number;
  } | null;
};

// Database row (snake_case) -> API shape (camelCase).
//
// nextSession and lastSession need group schedules and attendance, which
// don't exist yet. They are always null until those tables are built; the
// frontend already shows "No sessions yet" for null.
function toGradeSummary(row: GradeRow): GradeSummary {
  return {
    id: row.id,
    name: row.name,
    monthlyFee: row.monthly_fee,
    studentCount: row.student_count,
    groupCount: row.group_count,
    nextSession: null,
    lastSession: null,
  };
}

export async function listGrades(teacherId: string): Promise<GradeSummary[]> {
  const rows = await findGradesByTeacher(teacherId);

  return rows.map(toGradeSummary);
}

export async function createGrade(teacherId: string, input: GradeInput): Promise<GradeSummary> {
  try {
    const row = await insertGradeWithFirstGroup(teacherId, input, FIRST_GROUP_NAME);

    return toGradeSummary(row);
  } catch (error) {
    // The database is the one place that can answer "is this name taken?"
    // without a race: two "Create" clicks at the same moment can both pass a
    // check done in code, but only one can pass the unique index.
    if (isUniqueViolation(error, NAME_UNIQUE_INDEX)) {
      throw GradeErrors.nameTaken();
    }

    throw error;
  }
}

export async function editGrade(
  teacherId: string,
  gradeId: string,
  input: GradeInput
): Promise<GradeSummary> {
  let updated: boolean;

  try {
    updated = await updateGrade(teacherId, gradeId, input);
  } catch (error) {
    if (isUniqueViolation(error, NAME_UNIQUE_INDEX)) {
      throw GradeErrors.nameTaken();
    }

    throw error;
  }

  if (!updated) {
    throw GradeErrors.notFound();
  }

  // Read it back with its counts, so the card shows fresh numbers.
  const row = await findGradeById(teacherId, gradeId);

  if (!row) {
    // Deleted between the two queries (another tab, for example).
    throw GradeErrors.notFound();
  }

  return toGradeSummary(row);
}

export async function removeGrade(teacherId: string, gradeId: string): Promise<void> {
  let deleted: boolean;

  try {
    deleted = await deleteGradeWithoutStudents(teacherId, gradeId);
  } catch (error) {
    // A student was added in the split second between the check and the
    // delete. The foreign key caught it.
    // Either key can be the one that fires: the student points at the grade
    // directly and through its group.
    if (
      isForeignKeyViolation(error, STUDENT_GRADE_FOREIGN_KEY) ||
      isForeignKeyViolation(error, STUDENT_GROUP_FOREIGN_KEY)
    ) {
      throw GradeErrors.hasStudents();
    }

    throw error;
  }

  if (deleted) return;

  // Nothing was deleted: either the grade isn't there, or it has students.
  // One more query tells the two apart, so the teacher gets the right message.
  if (await gradeExists(teacherId, gradeId)) {
    throw GradeErrors.hasStudents();
  }

  throw GradeErrors.notFound();
}

// One grade with its groups, for the grade page. Its students come from
// their own endpoint (GET /teacher/grades/:gradeId/students): two lists
// that will each grow their own options (paging, archived students...).
export async function getGradeDetails(
  teacherId: string,
  gradeId: string
): Promise<{ grade: GradeSummary; groups: GroupSummary[] }> {
  // Both queries at once: they don't depend on each other.
  const [row, groups] = await Promise.all([
    findGradeById(teacherId, gradeId),
    listGroups(teacherId, gradeId),
  ]);

  if (!row) throw GradeErrors.notFound();

  return { grade: toGradeSummary(row), groups };
}
