import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

import { validateBody, validateQuery } from '../../middlware/validate';

import { GroupErrors } from './groups.errors';

// Same limit as the frontend form (GroupFormDialog).
export const groupInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

export type GroupInput = z.infer<typeof groupInputSchema>;

// Used by both create (POST) and rename (PATCH).
export const validateGroupInput = validateBody(groupInputSchema, 'Invalid group data');

// DELETE /teacher/groups/:groupId?moveStudentsTo=12
// The group that receives the deleted group's students. Optional: an empty
// group needs nowhere to send anyone.
export const deleteGroupQuerySchema = z.object({
  moveStudentsTo: z
    .string()
    .regex(/^[1-9]\d{0,17}$/)
    .optional()
    .transform((value) => value ?? null),
});

export type DeleteGroupQuery = z.infer<typeof deleteGroupQuerySchema>;

export const validateDeleteGroupQuery = validateQuery(deleteGroupQuerySchema, 'Invalid group');

// Group ids are bigserial numbers; anything else is answered as "not found"
// before it reaches the database (where it would fail as a type error, 500).
export function validateGroupId(req: Request, _res: Response, next: NextFunction): void {
  const { groupId } = req.params;

  if (typeof groupId !== 'string' || !/^[1-9]\d{0,17}$/.test(groupId)) {
    next(GroupErrors.notFound());
    return;
  }

  next();
}
