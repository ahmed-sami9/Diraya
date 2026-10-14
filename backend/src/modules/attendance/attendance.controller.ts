import type { Request, Response, NextFunction } from 'express';

import {
  getAttendanceOptions,
  getAttendanceSheet,
  saveAttendanceSheet,
} from './attendance.service';
import type { SheetQuery } from './attendance.validation';

// HTTP <-> service only. req.user is always set: these routes sit behind
// `authenticate` (teacher.routes.ts).

// GET /teacher/attendance/options
export async function getOptions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const grades = await getAttendanceOptions(req.user!.userId);

    res.status(200).json({ grades });
  } catch (error) {
    next(error);
  }
}

// GET /teacher/attendance/sheet?groupId=6&date=2026-10-12
export async function getSheet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Parsed by validateSheetQuery (Express 5's req.query is read-only).
    const query = res.locals.query as SheetQuery;

    const sheet = await getAttendanceSheet(req.user!.userId, query);

    res.status(200).json({ sheet });
  } catch (error) {
    next(error);
  }
}

// PUT /teacher/attendance/sheet
//
// 200, not 201: PUT says "make this sheet equal to what I sent", whether or
// not it existed before.
export async function putSheet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sheet = await saveAttendanceSheet(req.user!.userId, req.body);

    res.status(200).json({ sheet });
  } catch (error) {
    next(error);
  }
}
