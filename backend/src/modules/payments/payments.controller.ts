import type { Request, Response, NextFunction } from 'express';

import {
  getGradePayments,
  getPaymentsOverview,
  recordStudentPayment,
  saveStudentMonthNote,
  skipStudentMonth,
  unskipStudentMonth,
  voidStudentPayment,
} from './payments.service';
import type { GradePayments } from './payments.service';
import type { MonthQuery, NoteBody, ReasonBody } from './payments.validation';

const monthOf = (res: Response) => (res.locals.query as MonthQuery).month;
const param = (req: Request, name: string) => req.params[name] as string;

// Every write answers 200 with the fresh grade (the screen's new state).
function answerWithGrade(work: (req: Request, res: Response) => Promise<GradePayments>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json(await work(req, res));
    } catch (error) {
      next(error);
    }
  };
}

/* ---------------------------------- Reads --------------------------------- */

// GET /teacher/payments/overview?month=
export async function getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json(await getPaymentsOverview(req.user!.userId, monthOf(res)));
  } catch (error) {
    next(error);
  }
}

// GET /teacher/payments/grades/:gradeId?month=
export const getGrade = answerWithGrade((req, res) =>
  getGradePayments(req.user!.userId, param(req, 'gradeId'), monthOf(res))
);

/* --------------------------------- Writes --------------------------------- */

// POST /teacher/payments?month=
export const postPayment = answerWithGrade((req, res) =>
  recordStudentPayment(req.user!.userId, req.body, monthOf(res))
);

// POST /teacher/payments/:paymentId/void?month=
export const postVoid = answerWithGrade((req, res) =>
  voidStudentPayment(
    req.user!.userId,
    param(req, 'paymentId'),
    (req.body as ReasonBody).reason,
    monthOf(res)
  )
);

// PUT /teacher/payments/students/:studentId/months/:month/skip?month=
export const putSkip = answerWithGrade((req, res) =>
  skipStudentMonth(
    req.user!.userId,
    param(req, 'studentId'),
    param(req, 'month'),
    (req.body as ReasonBody).reason,
    monthOf(res)
  )
);

// DELETE /teacher/payments/students/:studentId/months/:month/skip?month=
export const deleteSkip = answerWithGrade((req, res) =>
  unskipStudentMonth(req.user!.userId, param(req, 'studentId'), param(req, 'month'), monthOf(res))
);

// PUT /teacher/payments/students/:studentId/months/:month/note?month=
export const putNote = answerWithGrade((req, res) =>
  saveStudentMonthNote(
    req.user!.userId,
    param(req, 'studentId'),
    param(req, 'month'),
    (req.body as NoteBody).text,
    monthOf(res)
  )
);
