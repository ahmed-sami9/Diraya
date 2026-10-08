import { z } from 'zod';

import { validateQuery } from '../../middlware/validate';

// ?q= for the navbar search. At least 2 characters, the same minimum as the
// frontend (MIN_SEARCH_LENGTH): one letter would match almost everyone.
//
// Inner spaces are collapsed, so "omar   adel" finds "Omar Adel".
export const studentSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, ' '))
    .pipe(z.string().min(2).max(100)),
});

export type StudentSearchQuery = z.infer<typeof studentSearchSchema>;

export const validateStudentSearch = validateQuery(studentSearchSchema, 'Invalid search');
