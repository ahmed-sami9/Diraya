import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

import { validateBody } from '../../middlware/validate';

import { GradeErrors } from './grades.errors';

// The same rules as the frontend form (GradeFormDialog). The frontend checks
// them for a quick message; these are the ones that actually protect the data.
export const gradeInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  monthlyFee: z.number().int().min(0).max(100_000).nullable(),
});

export type GradeInput = z.infer<typeof gradeInputSchema>;

// Used by both create (POST) and edit (PATCH): the form always sends both fields.
export const validateGradeInput = validateBody(gradeInputSchema, 'Invalid grade data');

// Grade ids are bigserial numbers. Anything else ("abc", "-1") can't be a
// grade, so it is answered as "not found" before it reaches the database,
// where it would otherwise fail as a type error (500).
export function validateGradeId(req: Request, _res: Response, next: NextFunction): void {
  const { gradeId } = req.params;

  if (typeof gradeId !== 'string' || !/^[1-9]\d{0,17}$/.test(gradeId)) {
    next(GradeErrors.notFound());
    return;
  }

  next();
}
