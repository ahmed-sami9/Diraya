import { AppError } from '../../errors/AppError';

// Every error the notes module throws on purpose. The codes are the ones the
// frontend reads in api/notes/notes.ts.
export const NoteErrors = {
  // Also when the note belongs to another teacher: never confirm that
  // someone else's id exists.
  notFound: () => new AppError(404, 'NOTE_NOT_FOUND', 'This note no longer exists.'),
};
