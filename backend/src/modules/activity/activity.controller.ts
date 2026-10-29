import type { Request, Response, NextFunction } from 'express';

import { listActivity } from './activity.service';
import type { ListActivityQuery } from './activity.validation';

// HTTP <-> service only. req.user is always set: this route sits behind
// `authenticate` (teacher.routes.ts).

// GET /teacher/activity?limit=6
export async function getActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Parsed by validateListActivityQuery (Express 5's req.query is read-only).
    const { limit } = res.locals.query as ListActivityQuery;

    res.status(200).json({ activity: await listActivity(req.user!.userId, limit) });
  } catch (error) {
    next(error);
  }
}
