import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

import { validateBody } from '../../../middlware/validate';

import { StudentErrors } from '../students.errors';

// Student ids are bigserial numbers; anything else is answered as "not found"
// before it reaches the database (where it would fail as a type error, 500).
export function validateStudentId(req: Request, _res: Response, next: NextFunction): void {
  const { studentId } = req.params;

  if (typeof studentId !== 'string' || !/^[1-9]\d{0,17}$/.test(studentId)) {
    next(StudentErrors.notFound());
    return;
  }

  next();
}

// POST /teacher/students/:studentId/notes
// Same limit as the frontend (NotesPanel's NOTE_MAX_LENGTH). Line breaks are
// kept: a note can be a short list.
export const noteInputSchema = z.object({
  text: z.string().trim().min(1).max(1000),
});

export type NoteInput = z.infer<typeof noteInputSchema>;

export const validateNoteInput = validateBody(noteInputSchema, 'Invalid note');
