import { z } from 'zod';

import { validateBody, validateQuery } from '../../middlware/validate';
import { isValidIsoDay } from '../../utils/cairoDate';

import { ATTENDANCE_STATUSES } from './attendance.rules';

// Ids are bigserial numbers, sent as strings.
const idSchema = z.string().regex(/^[1-9]\d{0,17}$/);

// "YYYY-MM-DD", and a real day. Whether it's in the future is checked in the
// service, which knows what "today in Egypt" is.
const daySchema = z.string().refine(isValidIsoDay, 'Expected a day as YYYY-MM-DD');

/* ------------------------- GET /attendance/sheet ------------------------- */

export const sheetQuerySchema = z.object({
  // Optional: without it, the server picks the default group.
  groupId: idSchema.optional().transform((value) => value ?? null),
  date: daySchema,
});

export type SheetQuery = z.infer<typeof sheetQuerySchema>;

export const validateSheetQuery = validateQuery(sheetQuerySchema, 'Invalid sheet request');

/* ------------------------- PUT /attendance/sheet ------------------------- */

const recordSchema = z.object({
  studentId: idSchema,
  status: z.enum(ATTENDANCE_STATUSES),
  // An empty reason is stored as "no reason" (null), not as "".
  reason: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .transform((value) => (value ? value : null)),
});

export const saveSheetSchema = z.object({
  groupId: idSchema,
  date: daySchema,
  // The whole sheet, every time. 1-500: a class with no students has nothing
  // to save, and 500 is far above any real class (a cap on request size).
  records: z
    .array(recordSchema)
    .min(1)
    .max(500)
    // One mark per student: the same student twice would be ambiguous.
    .refine(
      (records) => new Set(records.map((record) => record.studentId)).size === records.length,
      'Each student can appear only once'
    ),
});

export type SaveSheetInput = z.infer<typeof saveSheetSchema>;

export const validateSaveSheet = validateBody(saveSheetSchema, 'Invalid attendance sheet');
