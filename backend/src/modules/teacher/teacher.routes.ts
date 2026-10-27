import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware';

import gradesRoutes from '../grades/grades.routes';
import groupsRoutes from '../groups/groups.routes';
import studentsRoutes from '../students/students.routes';
import attendanceRoutes from '../attendance/attendance.routes';
import examsRoutes from '../exams/exams.routes';
import paymentsRoutes from '../payments/payments.routes';
import accountRoutes from '../account/account.routes';
import homeRoutes from '../home/home.routes';

const router = Router();

// The Home page's summary: one request for all of its numbers.
router.use('/home', authenticate, homeRoutes);

// Everything a signed-in teacher manages. `authenticate` runs first on each,
// so the routers inside can rely on req.user being set.
router.use('/grades', authenticate, gradesRoutes);
router.use('/groups', authenticate, groupsRoutes);
router.use('/students', authenticate, studentsRoutes);
router.use('/attendance', authenticate, attendanceRoutes);
router.use('/exams', authenticate, examsRoutes);
router.use('/payments', authenticate, paymentsRoutes);
router.use('/account', authenticate, accountRoutes);

export default router;
