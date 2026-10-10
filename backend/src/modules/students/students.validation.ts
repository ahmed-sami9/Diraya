import { z } from 'zod';

import { validateBody, validateQuery } from '../../middlware/validate';

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

/* ------------------------------ Add a student ----------------------------- */

// The frontend already normalizes phones to "01012345678"; this is the rule
// the server keeps no matter who calls it.
const egyptMobile = z.string().regex(/^01[0125]\d{8}$/, 'Expected an Egyptian mobile number');

// Same rules and limits as the frontend form (StudentFormDialog).
export const studentInputSchema = z.object({
  fullName: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, ' '))
    .pipe(z.string().min(1).max(100)),
  parentPhone: egyptMobile,
  phone: egyptMobile.nullable(),
  // Required: every student is in a group (their attendance sheet).
  groupId: z.string().regex(/^[1-9]\d{0,17}$/),
  // An empty note is stored as "no note" (null), not as "".
  notes: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .transform((value) => (value ? value : null)),
});

export type StudentInput = z.infer<typeof studentInputSchema>;

export const validateStudentInput = validateBody(studentInputSchema, 'Invalid student data');
