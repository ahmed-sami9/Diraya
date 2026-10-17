import type { Request, Response, NextFunction } from 'express';

import {
  createExam,
  editExam,
  getExamDetail,
  getExams,
  removeExam,
  saveExamResults,
} from './exams.service';

// HTTP <-> service only. req.user is always set: these routes sit behind
// `authenticate` (teacher.routes.ts), and :examId was checked by
// validateExamId.

const examIdOf = (req: Request) => req.params.examId as string;

// GET /teacher/exams
export async function listExams(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const exams = await getExams(req.user!.userId);

    res.status(200).json({ exams });
  } catch (error) {
    next(error);
  }
}

// POST /teacher/exams -> 201: a new exam was created.
export async function postExam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const exam = await createExam(req.user!.userId, req.body);

    res.status(201).json({ exam });
  } catch (error) {
    next(error);
  }
}

// GET /teacher/exams/:examId
export async function getExam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const detail = await getExamDetail(req.user!.userId, examIdOf(req));

    res.status(200).json(detail);
  } catch (error) {
    next(error);
  }
}

// PATCH /teacher/exams/:examId
export async function patchExam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const detail = await editExam(req.user!.userId, examIdOf(req), req.body);

    res.status(200).json(detail);
  } catch (error) {
    next(error);
  }
}

// DELETE /teacher/exams/:examId -> 204: done, nothing to send back.
export async function deleteExam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await removeExam(req.user!.userId, examIdOf(req));

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

// PUT /teacher/exams/:examId/results
//
// 200, not 201: PUT says "make these students' results equal to what I
// sent", whether or not they existed before.
export async function putResults(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const detail = await saveExamResults(req.user!.userId, examIdOf(req), req.body);

    res.status(200).json(detail);
  } catch (error) {
    next(error);
  }
}
