import type { Request, Response, NextFunction } from 'express';

import { searchStudents } from './students.service';
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
