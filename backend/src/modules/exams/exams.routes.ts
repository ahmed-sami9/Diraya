import { Router } from 'express';

import {
  deleteExam,
  getExam,
  listExams,
  patchExam,
  postExam,
  putResults,
} from './exams.controller';
import {
  validateCreateExam,
  validateExamId,
  validateSaveResults,
  validateUpdateExam,
} from './exams.validation';

// Mounted at /api/v1/teacher/exams, behind `authenticate` (teacher.routes.ts).
//
//   GET    /                   -> { exams }      the list, with counted results
//   POST   /                   -> 201 { exam }   add an exam to a grade
//   GET    /:examId            -> ExamDetail     the exam page. Read only.
//   PATCH  /:examId            -> ExamDetail     edit (never the grade)
//   DELETE /:examId            -> 204            its results go with it
//   PUT    /:examId/results    -> ExamDetail     save the listed students' marks
//
// The middleware order is the request's path: check the id, check the body,
// then the controller. A bad request never reaches the service.
const router = Router();

router.get('/', listExams);
router.post('/', validateCreateExam, postExam);

router.get('/:examId', validateExamId, getExam);
router.patch('/:examId', validateExamId, validateUpdateExam, patchExam);
router.delete('/:examId', validateExamId, deleteExam);

router.put('/:examId/results', validateExamId, validateSaveResults, putResults);

export default router;
