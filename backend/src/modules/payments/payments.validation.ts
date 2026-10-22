import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

import { AppError } from '../../errors/AppError';
import { validateBody, validateQuery } from '../../middlware/validate';
import { currentMonthInCairo, isValidIsoDay, todayInCairo } from '../../utils/cairoDate';

import { GradeErrors } from '../grades/grades.errors';
import { StudentErrors } from '../students/students.errors';

import { PaymentErrors } from './payments.errors';
import { addMonths } from './payments.service';

const idSchema = z.string().regex(/^[1-9]\d{0,17}$/);

const monthSchema = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/, 'Expected a month as YYYY-MM');

// Paying or skipping ahead is allowed one month: the grid shows one future month.
const isWithinNextMonth = (month: string) => month <= addMonths(currentMonthInCairo(), 1);

/* ------------------------------ ?month= query ----------------------------- */

export const monthQuerySchema = z.object({
  month: monthSchema.refine(
    (month) => month <= currentMonthInCairo(),
    'This month hasn’t come yet'
  ),
});

export type MonthQuery = z.infer<typeof monthQuerySchema>;

export const validateMonthQuery = validateQuery(monthQuerySchema, 'Invalid month');

/* --------------------------------- Params --------------------------------- */

// A malformed id can't exist: 404 here instead of a type error (500) in SQL.
function validateIdParam(name: string, notFound: () => AppError) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const value = req.params[name];

    if (typeof value !== 'string' || !idSchema.safeParse(value).success) {
      next(notFound());
      return;
    }

    next();
  };
}

export const validateGradeId = validateIdParam('gradeId', GradeErrors.notFound);
export const validatePaymentId = validateIdParam('paymentId', PaymentErrors.paymentNotFound);

// /students/:studentId/months/:month
export function validateStudentMonth(req: Request, _res: Response, next: NextFunction): void {
  const { studentId, month } = req.params;

  if (typeof studentId !== 'string' || !idSchema.safeParse(studentId).success) {
    next(StudentErrors.notFound());
    return;
  }

  if (
    typeof month !== 'string' ||
    !monthSchema.safeParse(month).success ||
    !isWithinNextMonth(month)
  ) {
    next(new AppError(400, 'INVALID_INPUT', 'Invalid month'));
    return;
  }

  next();
}

/* ------------------------------ Record payment ---------------------------- */

const noteSchema = z
  .string()
  .trim()
  .max(300)
  .nullable()
  .transform((note) => note || null);

export const recordPaymentSchema = z
  .object({
    requestId: z.uuid(),
    studentId: idSchema,
    months: z
      .array(monthSchema.refine(isWithinNextMonth, 'Only up to next month can be paid ahead'))
      .min(1)
      .max(12)
      .refine((months) => new Set(months).size === months.length, 'Each month only once'),
    amount: z.number().int().min(1).max(1_000_000),
    paidOn: z
      .string()
      .refine(isValidIsoDay, 'Expected a day as YYYY-MM-DD')
      .refine((day) => day <= todayInCairo(), 'The day it was paid can’t be in the future'),
    method: z.enum(['cash', 'instapay', 'vodafone-cash']),
    note: noteSchema,
  })
  .strict();

export type RecordPaymentBody = z.infer<typeof recordPaymentSchema>;

export const validateRecordPayment = validateBody(recordPaymentSchema, 'Invalid payment');

/* ---------------------------- Void / skip / note --------------------------- */

const reasonSchema = z.object({ reason: z.string().trim().min(1).max(200) }).strict();

export type ReasonBody = z.infer<typeof reasonSchema>;

export const validateVoid = validateBody(reasonSchema, 'Give a reason for voiding');
export const validateSkip = validateBody(reasonSchema, 'Give a reason for skipping');

// An empty note removes it.
const noteBodySchema = z.object({ text: z.string().trim().max(300) }).strict();

export type NoteBody = z.infer<typeof noteBodySchema>;

export const validateNote = validateBody(noteBodySchema, 'Invalid note');
