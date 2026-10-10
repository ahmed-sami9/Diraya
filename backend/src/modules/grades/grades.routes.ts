import { Router } from 'express';

import { gradeGroupsRouter } from '../groups/groups.routes';
import { gradeStudentsRouter } from '../students/students.routes';

import { deleteGrade, getGrade, getGrades, patchGrade, postGrade } from './grades.controller';
import { validateGradeId, validateGradeInput } from './grades.validation';

// Mounted at /api/v1/teacher/grades, behind `authenticate` (teacher.routes.ts).
//
// Each route reads left to right as a checklist: is the id valid -> is the
// body valid -> do the work.
const router = Router();

router.get('/', getGrades);

router.post('/', validateGradeInput, postGrade);

// One grade with its groups: the grade page's header and group buttons.
router.get('/:gradeId', validateGradeId, getGrade);

router.patch('/:gradeId', validateGradeId, validateGradeInput, patchGrade);

router.delete('/:gradeId', validateGradeId, deleteGrade);

// Things that live inside a grade. The grade id is checked once here, for
// every route below it, before the groups or students code runs.
router.use('/:gradeId/groups', validateGradeId, gradeGroupsRouter);
router.use('/:gradeId/students', validateGradeId, gradeStudentsRouter);

export default router;
