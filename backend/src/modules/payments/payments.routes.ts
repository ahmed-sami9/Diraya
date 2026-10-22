import { Router } from 'express';

import {
  deleteSkip,
  getGrade,
  getOverview,
  postPayment,
  postVoid,
  putNote,
  putSkip,
} from './payments.controller';
import {
  validateGradeId,
  validateMonthQuery,
  validateNote,
  validatePaymentId,
  validateRecordPayment,
  validateSkip,
  validateStudentMonth,
  validateVoid,
} from './payments.validation';

// Mounted at /api/v1/teacher/payments, behind `authenticate`.
// ?month= is the month on screen: every write answers with that month's grade.
const router = Router();

router.get('/overview', validateMonthQuery, getOverview);
router.get('/grades/:gradeId', validateGradeId, validateMonthQuery, getGrade);

router.post('/', validateMonthQuery, validateRecordPayment, postPayment);
router.post('/:paymentId/void', validatePaymentId, validateMonthQuery, validateVoid, postVoid);

const studentMonth = '/students/:studentId/months/:month';
router.put(`${studentMonth}/skip`, validateStudentMonth, validateMonthQuery, validateSkip, putSkip);
router.delete(`${studentMonth}/skip`, validateStudentMonth, validateMonthQuery, deleteSkip);
router.put(`${studentMonth}/note`, validateStudentMonth, validateMonthQuery, validateNote, putNote);

export default router;
