import { Router } from 'express';

import { deleteGrade, getGrades, patchGrade, postGrade } from './grades.controller';
import { validateGradeId, validateGradeInput } from './grades.validation';

// Mounted at /api/v1/teacher/grades, behind `authenticate` (teacher.routes.ts).
//
// Each route reads left to right as a checklist: is the id valid -> is the
// body valid -> do the work.
const router = Router();

router.get('/', getGrades);

router.post('/', validateGradeInput, postGrade);

router.patch('/:gradeId', validateGradeId, validateGradeInput, patchGrade);

router.delete('/:gradeId', validateGradeId, deleteGrade);

export default router;
