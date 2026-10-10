import type { Request, Response, NextFunction } from 'express';

import { createGroup, removeGroup, renameGroup } from './groups.service';
import type { DeleteGroupQuery } from './groups.validation';

// HTTP <-> service only. req.user is always set: these routes sit behind
// `authenticate` (teacher.routes.ts).

// POST /teacher/grades/:gradeId/groups
export async function postGroup(
  req: Request<{ gradeId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const group = await createGroup(req.user!.userId, req.params.gradeId, req.body);

    res.status(201).json({ group });
  } catch (error) {
    next(error);
  }
}

// PATCH /teacher/groups/:groupId
export async function patchGroup(
  req: Request<{ groupId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const group = await renameGroup(req.user!.userId, req.params.groupId, req.body);

    res.status(200).json({ group });
  } catch (error) {
    next(error);
  }
}

// DELETE /teacher/groups/:groupId?moveStudentsTo=12
export async function deleteGroup(
  req: Request<{ groupId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Parsed by validateDeleteGroupQuery (Express 5's req.query is read-only).
    const { moveStudentsTo } = res.locals.query as DeleteGroupQuery;

    await removeGroup(req.user!.userId, req.params.groupId, moveStudentsTo);

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
