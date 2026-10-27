import type { Request, Response, NextFunction } from 'express';

import { getHomeSummary } from './home.service';

// GET /teacher/home
export async function getHome(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const summary = await getHomeSummary(req.user!.userId);

    res.status(200).json({ summary });
  } catch (error) {
    next(error);
  }
}
