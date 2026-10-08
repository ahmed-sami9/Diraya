import { Router } from 'express';

import { getStudentSearch } from './students.controller';
import { validateStudentSearch } from './students.validation';

// Mounted at /api/v1/teacher/students, behind `authenticate` (teacher.routes.ts).
// Adding, editing and moving students will join this router with the grade page.
const router = Router();

// Must stay above any future "/:studentId" route, or Express would read
// "search" as a student id.
router.get('/search', validateStudentSearch, getStudentSearch);

export default router;
