import type { Request, Response, NextFunction } from 'express';

import {
  addStudentNote,
  getStudentProfile,
  listStudentAttendance,
  listStudentExams,
  listStudentNotes,
  listStudentPayments,
} from './students.profile.service';

// HTTP <-> service only. req.user is always set (behind `authenticate`), and
// :studentId is already checked by validateStudentId.
//
// Every list answers under its own key ({ attendance: [...] }), never a bare
// array: a field can be added next to it later (paging, totals) without
// breaking the frontend.

type StudentParams = { studentId: string };

// GET /teacher/students/:studentId
export async function getProfile(
  req: Request<StudentParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const profile = await getStudentProfile(req.user!.userId, req.params.studentId);

    res.status(200).json({ profile });
  } catch (error) {
    next(error);
  }
}

// GET /teacher/students/:studentId/attendance
export async function getAttendance(
  req: Request<StudentParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const attendance = await listStudentAttendance(req.user!.userId, req.params.studentId);

    res.status(200).json({ attendance });
  } catch (error) {
    next(error);
  }
}

// GET /teacher/students/:studentId/exams
export async function getExams(
  req: Request<StudentParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const exams = await listStudentExams(req.user!.userId, req.params.studentId);

    res.status(200).json({ exams });
  } catch (error) {
    next(error);
  }
}

// GET /teacher/students/:studentId/payments
export async function getPayments(
  req: Request<StudentParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payments = await listStudentPayments(req.user!.userId, req.params.studentId);

    res.status(200).json({ payments });
  } catch (error) {
    next(error);
  }
}

// GET /teacher/students/:studentId/notes
export async function getNotes(
  req: Request<StudentParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const notes = await listStudentNotes(req.user!.userId, req.params.studentId);

    res.status(200).json({ notes });
  } catch (error) {
    next(error);
  }
}

// POST /teacher/students/:studentId/notes
export async function postNote(
  req: Request<StudentParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const note = await addStudentNote(req.user!.userId, req.params.studentId, req.body);

    res.status(201).json({ note });
  } catch (error) {
    next(error);
  }
}
