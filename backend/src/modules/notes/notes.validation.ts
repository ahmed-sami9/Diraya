import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

import { validateBody, validateQuery } from '../../middlware/validate';

import { NoteErrors } from './notes.errors';

// Same limit as the form (NoteComposer) and the database (varchar(1000)).
// Trimmed first, so "   " is empty and the limit counts real characters.
const noteText = z.string().trim().min(1, 'Write something first').max(1000);

// POST /teacher/notes
export const createNoteSchema = z.object({ text: noteText }).strict();

export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const validateCreateNote = validateBody(createNoteSchema, 'Invalid note');

// PATCH /teacher/notes/:noteId: the text, the pin, or both. An empty body
// changes nothing, so it's refused instead of answering "saved".
export const updateNoteSchema = z
  .object({ text: noteText.optional(), pinned: z.boolean().optional() })
  .strict()
  .refine((changes) => changes.text !== undefined || changes.pinned !== undefined, {
    message: 'Send the text, pinned, or both',
  });

export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

export const validateUpdateNote = validateBody(updateNoteSchema, 'Invalid note');

// GET /teacher/notes?limit=5 (the Home card). No limit = every note. Capped,
// so a typo like ?limit=99999999 can't ask for a huge page.
export const listNotesQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^[1-9]\d{0,2}$/)
    .transform(Number)
    .refine((limit) => limit <= 50)
    .optional()
    .transform((limit) => limit ?? null),
});

export type ListNotesQuery = z.infer<typeof listNotesQuerySchema>;

export const validateListNotesQuery = validateQuery(listNotesQuerySchema, 'Invalid notes request');

// Note ids are bigserial numbers; anything else is "not found" before it
// reaches the database (where it would fail as a type error, 500).
export function validateNoteId(req: Request, _res: Response, next: NextFunction): void {
  const { noteId } = req.params;

  if (typeof noteId !== 'string' || !/^[1-9]\d{0,17}$/.test(noteId)) {
    next(NoteErrors.notFound());
    return;
  }

  next();
}
