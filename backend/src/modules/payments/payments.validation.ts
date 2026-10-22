import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

import { validateQuery } from '../../middlware/validate';
import { currentMonthInCairo } from '../../utils/cairoDate';

import { GradeErrors } from '../grades/grades.errors';

const idSchema = z.string().regex(/^[1-9]\d{0,17}$/);

const monthSchema = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/, 'Expected a month as YYYY-MM');

/* ------------------------------ ?month= query ----------------------------- */

export const monthQuerySchema = z.object({
  month: monthSchema.refine(
    (month) => month <= currentMonthInCairo(),
    'This month hasn’t come yet'
  ),
});

export type MonthQuery = z.infer<typeof monthQuerySchema>;

export const validateMonthQuery = validateQuery(monthQuerySchema, 'Invalid month');

/* ------------------------------ :gradeId param ---------------------------- */

// A malformed id can't be a grade: 404 here instead of a type error (500) in SQL.
export function validateGradeId(req: Request, _res: Response, next: NextFunction): void {
  const { gradeId } = req.params;

  if (typeof gradeId !== 'string' || !idSchema.safeParse(gradeId).success) {
    next(GradeErrors.notFound());
    return;
  }

  next();
}
