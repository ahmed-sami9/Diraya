import { Router } from 'express';

import { getGradeStudents, getStudentSearch, postStudent } from './students.controller';
import { validateStudentInput, validateStudentSearch } from './students.validation';
import studentProfileRouter from './profile/students.profile.routes';
import { validateStudentId } from './profile/students.profile.validation';

// Students have two kinds of address, like groups (see groups.routes.ts):
//
//   Inside a grade:  GET, POST /teacher/grades/:gradeId/students -> gradeStudentsRouter
//   On their own:    GET /teacher/students/search                -> default router
//                    /teacher/students/:studentId/...            -> studentProfileRouter

// mergeParams: lets this router read :gradeId from grades.routes.ts.
export const gradeStudentsRouter = Router({ mergeParams: true });

gradeStudentsRouter.get('/', getGradeStudents);

gradeStudentsRouter.post('/', validateStudentInput, postStudent);

// Mounted at /api/v1/teacher/students, behind `authenticate` (teacher.routes.ts).
const router = Router();

// Must stay above any future "/:studentId" route, or Express would read
// "search" as a student id.
router.get('/search', validateStudentSearch, getStudentSearch);

// One student's profile and its tabs. The id is checked once here, for every
// route below it (the same pattern as grades.routes.ts).
router.use('/:studentId', validateStudentId, studentProfileRouter);

export default router;
