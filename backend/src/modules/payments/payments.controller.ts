import type { Request, Response, NextFunction } from 'express';

import { getGradePayments, getPaymentsOverview } from './payments.service';
import type { MonthQuery } from './payments.validation';

const monthOf = (res: Response) => (res.locals.query as MonthQuery).month;

// GET /teacher/payments/overview?month=
export async function getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const overview = await getPaymentsOverview(req.user!.userId, monthOf(res));

    res.status(200).json(overview);
  } catch (error) {
    next(error);
  }
}

// GET /teacher/payments/grades/:gradeId?month=
export async function getGrade(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const grade = await getGradePayments(
      req.user!.userId,
      req.params.gradeId as string,
      monthOf(res)
    );

    res.status(200).json(grade);
  } catch (error) {
    next(error);
  }
}
