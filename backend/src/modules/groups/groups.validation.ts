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

// PUT /teacher/groups/:groupId/schedule: the whole week, every time.
// The same rules as the database, checked first so a mistake gets a clear
// 400 instead of a database error. Times are 24-hour "HH:MM" in Egypt.
const sessionSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a time as HH:MM'),
  })
  .strict();

export const scheduleInputSchema = z
  .object({
    sessions: z
      .array(sessionSchema)
      .max(7)
      .refine(
        (sessions) => new Set(sessions.map((session) => session.dayOfWeek)).size === sessions.length,
        'Each day can appear only once'
      ),
  })
  .strict();

export type ScheduleInput = z.infer<typeof scheduleInputSchema>;

export const validateScheduleInput = validateBody(scheduleInputSchema, 'Invalid schedule');

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
