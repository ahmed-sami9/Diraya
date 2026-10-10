import type { Request, Response, NextFunction } from 'express';

import { createGrade, editGrade, getGradeDetails, listGrades, removeGrade } from './grades.service';

// Controllers only translate HTTP <-> service calls: read the request, call
// the service, choose the status code. No SQL and no business rules here.
//
// req.user is always set on these routes: they sit behind `authenticate`
// (see teacher.routes.ts). The `!` says so to TypeScript.

export async function getGrades(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const grades = await listGrades(req.user!.userId);

    res.status(200).json({ grades });
  } catch (error) {
    next(error);
  }
}

// GET /teacher/grades/:gradeId
export async function getGrade(
  req: Request<{ gradeId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const details = await getGradeDetails(req.user!.userId, req.params.gradeId);

    res.status(200).json(details);
  } catch (error) {
    next(error);
  }
}

export async function postGrade(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const grade = await createGrade(req.user!.userId, req.body);

    res.status(201).json({ grade });
  } catch (error) {
    next(error);
  }
}

export async function patchGrade(
  req: Request<{ gradeId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const grade = await editGrade(req.user!.userId, req.params.gradeId, req.body);

    res.status(200).json({ grade });
  } catch (error) {
    next(error);
  }
}

export async function deleteGrade(
  req: Request<{ gradeId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await removeGrade(req.user!.userId, req.params.gradeId);

    // 204: done, and there is nothing to send back.
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
