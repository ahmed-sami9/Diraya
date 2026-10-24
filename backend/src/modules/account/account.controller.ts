import type { Request, Response, NextFunction } from 'express';

import { changePassword, getAccount, updateProfile } from './account.service';

// req.user is always set here: these routes sit behind `authenticate`
// (teacher.routes.ts). The `!` says so to TypeScript.

// GET /teacher/account
export async function getAccountController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const account = await getAccount(req.user!.userId);

    res.status(200).json({ account });
  } catch (error) {
    next(error);
  }
}

// PATCH /teacher/account/profile
export async function patchProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const account = await updateProfile(req.user!.userId, req.body);

    res.status(200).json({ account });
  } catch (error) {
    next(error);
  }
}

// POST /teacher/account/password
export async function postPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await changePassword(req.user!.userId, req.user!.sessionId, req.body);

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
