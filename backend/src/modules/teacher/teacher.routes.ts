import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware';

import gradesRoutes from '../grades/grades.routes';
import groupsRoutes from '../groups/groups.routes';
import studentsRoutes from '../students/students.routes';

const router = Router();

router.post('/home', authenticate, (req, res) => {
  res.send('teacher');
});

// Everything a signed-in teacher manages. `authenticate` runs first on each,
// so the routers inside can rely on req.user being set.
router.use('/grades', authenticate, gradesRoutes);
router.use('/groups', authenticate, groupsRoutes);
router.use('/students', authenticate, studentsRoutes);

export default router;
