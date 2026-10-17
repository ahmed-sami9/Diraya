import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

import { validateBody } from '../../middlware/validate';
import { isValidIsoDay } from '../../utils/cairoDate';

import { ExamErrors } from './exams.errors';

// Every limit here matches the Add exam form (ExamFormDialog.tsx) and the
// database's CHECKs (the create-exams migration). Three layers, one set of
// numbers: the form for quick feedback, this for clear 400s, the database as
// the rule no code path can skip.

const TITLE_MAX_LENGTH = 80;
const MAX_MARK_LIMIT = 1000;

// Ids are bigserial numbers, sent as strings.
const idSchema = z.string().regex(/^[1-9]\d{0,17}$/);

const daySchema = z.string().refine(isValidIsoDay, 'Expected a day as YYYY-MM-DD');

// 20 or 20.5: whole or half marks only.
const markSchema = z
  .number()
  .nonnegative()
  .refine((value) => Number.isInteger(value * 2), 'Marks are whole or halves, like 31.5');

/* ------------------------------ :examId param ----------------------------- */

// Anything that isn't an id can't be an exam: "not found" before it reaches
// the database (where it would fail as a type error, 500).
export function validateExamId(req: Request, _res: Response, next: NextFunction): void {
  const { examId } = req.params;

  if (typeof examId !== 'string' || !idSchema.safeParse(examId).success) {
    next(ExamErrors.notFound());
    return;
  }

  next();
}

/* --------------------------- POST and PATCH body -------------------------- */

const examFields = {
  title: z.string().trim().min(1).max(TITLE_MAX_LENGTH),
  kind: z.enum(['exam', 'quiz']),
  heldOn: daySchema,
  maxMark: z.number().int().min(1).max(MAX_MARK_LIMIT),
  passMark: markSchema.positive(),
};

// The pass mark can't be above "out of". (Checked on the object because it
// compares two fields.)
const passMarkFits = (input: { maxMark: number; passMark: number }) =>
  input.passMark <= input.maxMark;
const passMarkIssue = {
  message: 'The pass mark can’t be higher than "out of"',
  path: ['passMark'],
};

// POST /teacher/exams
export const createExamSchema = z
  .object({ ...examFields, gradeId: idSchema })
  .refine(passMarkFits, passMarkIssue);

export type CreateExamInput = z.infer<typeof createExamSchema>;

export const validateCreateExam = validateBody(createExamSchema, 'Invalid exam');

// PATCH /teacher/exams/:examId
//
// strict(): a gradeId in an edit is refused, not silently ignored. The grade
// can't change (the results belong to that grade's students), and a client
// that thinks it can should hear so.
export const updateExamSchema = z.object(examFields).strict().refine(passMarkFits, passMarkIssue);

export type UpdateExamInput = z.infer<typeof updateExamSchema>;

export const validateUpdateExam = validateBody(updateExamSchema, 'Invalid exam');

/* -------------------------- PUT /:examId/results -------------------------- */

// One student's result. A discriminated union: each status has exactly the
// fields it needs, so "absent with a score" can't even be expressed.
const resultSchema = z.discriminatedUnion('status', [
  z.object({ studentId: idSchema, status: z.literal('scored'), score: markSchema }),
  z.object({ studentId: idSchema, status: z.literal('absent'), score: z.null() }),
  // The teacher cleared the box: remove the saved result.
  z.object({ studentId: idSchema, status: z.literal('not-entered'), score: z.null() }),
]);

export const saveResultsSchema = z.object({
  // Only the students that changed. 1-500: an empty save means nothing, and
  // 500 is far above any real grade (a cap on request size).
  results: z
    .array(resultSchema)
    .min(1)
    .max(500)
    // One result per student: the same student twice would be ambiguous.
    .refine(
      (results) => new Set(results.map((item) => item.studentId)).size === results.length,
      'Each student can appear only once'
    ),
});

export type SaveResultsInput = z.infer<typeof saveResultsSchema>;

export const validateSaveResults = validateBody(saveResultsSchema, 'Invalid marks');
