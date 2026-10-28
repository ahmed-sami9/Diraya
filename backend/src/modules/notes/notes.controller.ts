import type { Request, Response, NextFunction } from 'express';

import { addNote, changeNote, listNotes, removeNote } from './notes.service';
import type { ListNotesQuery } from './notes.validation';

// HTTP <-> service only. req.user is always set: these routes sit behind
// `authenticate` (teacher.routes.ts).

// GET /teacher/notes?limit=5
export async function getNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Parsed by validateListNotesQuery (Express 5's req.query is read-only).
    const { limit } = res.locals.query as ListNotesQuery;

    res.status(200).json(await listNotes(req.user!.userId, limit));
  } catch (error) {
    next(error);
  }
}

// POST /teacher/notes
export async function postNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const note = await addNote(req.user!.userId, req.body);

    res.status(201).json({ note });
  } catch (error) {
    next(error);
  }
}

// PATCH /teacher/notes/:noteId
export async function patchNote(
  req: Request<{ noteId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const note = await changeNote(req.user!.userId, req.params.noteId, req.body);

    res.status(200).json({ note });
  } catch (error) {
    next(error);
  }
}

// DELETE /teacher/notes/:noteId
export async function deleteNote(
  req: Request<{ noteId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await removeNote(req.user!.userId, req.params.noteId);

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
