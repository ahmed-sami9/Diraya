import { z } from 'zod';

import { validateQuery } from '../../middlware/validate';

// GET /teacher/activity?limit=6. The only input this module takes: activity
// itself is never sent by a client, only written by the backend's own
// actions (and checked by TypeScript there, see activity.types.ts).
//
// No limit = the latest 10. Capped at 50, like every list here.
export const listActivityQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^[1-9]\d{0,2}$/)
    .transform(Number)
    .refine((limit) => limit <= 50)
    .optional()
    .transform((limit) => limit ?? 10),
});

export type ListActivityQuery = z.infer<typeof listActivityQuerySchema>;

export const validateListActivityQuery = validateQuery(
  listActivityQuerySchema,
  'Invalid activity request'
);
