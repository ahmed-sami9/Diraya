import { Router } from 'express';

import { getGrade, getOverview } from './payments.controller';
import { validateGradeId, validateMonthQuery } from './payments.validation';

// Mounted at /api/v1/teacher/payments, behind `authenticate`.
const router = Router();

router.get('/overview', validateMonthQuery, getOverview);
router.get('/grades/:gradeId', validateGradeId, validateMonthQuery, getGrade);

export default router;
