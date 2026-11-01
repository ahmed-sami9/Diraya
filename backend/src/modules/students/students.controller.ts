import type { Request, Response, NextFunction } from 'express';

import { addStudent, editStudent, listGradeStudents, searchStudents } from './students.service';
import type { StudentSearchQuery } from './students.validation';

// GET /teacher/students/search?q=om
// The checked query is in res.locals.query (see validateQuery).
export async function getStudentSearch(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { q } = res.locals.query as StudentSearchQuery;

    const students = await searchStudents(req.user!.userId, q);

    res.status(200).json({ students });
  } catch (error) {
    next(error);
  }
}

// GET /teacher/grades/:gradeId/students
export async function getGradeStudents(
  req: Request<{ gradeId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const students = await listGradeStudents(req.user!.userId, req.params.gradeId);

    res.status(200).json({ students });
  } catch (error) {
    next(error);
  }
}

// POST /teacher/grades/:gradeId/students
export async function postStudent(
  req: Request<{ gradeId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const student = await addStudent(req.user!.userId, req.params.gradeId, req.body);

    res.status(201).json({ student });
  } catch (error) {
    next(error);
  }
}

export async function patchStudent(
  req: Request<{ studentId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const profile = await editStudent(req.user!.userId, req.params.studentId, req.body);

    res.status(200).json({ profile });
  } catch (error) {
    next(error);
  }
}
