import { Router } from 'express';

import { deleteNote, getNotes, patchNote, postNote } from './notes.controller';
import {
  validateCreateNote,
  validateListNotesQuery,
  validateNoteId,
  validateUpdateNote,
} from './notes.validation';

// The teacher's own notes (My notes), mounted at /teacher/notes:
//
//   GET    /teacher/notes              every note, pinned first, newest first
//   GET    /teacher/notes?limit=5      the first few (Home card), plus total
//   POST   /teacher/notes              add one
//   PATCH  /teacher/notes/:noteId      change the text, the pin, or both
//   DELETE /teacher/notes/:noteId

const router = Router();

router.get('/', validateListNotesQuery, getNotes);
router.post('/', validateCreateNote, postNote);
router.patch('/:noteId', validateNoteId, validateUpdateNote, patchNote);
router.delete('/:noteId', validateNoteId, deleteNote);

export default router;
