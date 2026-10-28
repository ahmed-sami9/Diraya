import { NoteErrors } from './notes.errors';
import {
  deleteTeacherNote,
  findTeacherNotes,
  insertTeacherNote,
  updateTeacherNote,
  type TeacherNoteRow,
} from './notes.repository';
import type { CreateNoteInput, UpdateNoteInput } from './notes.validation';

// The teacher's own notes (My notes). The rules live in the database and the
// repository; this layer shapes rows for the API and turns "no such note"
// into a 404.

export type TeacherNote = {
  id: string;
  text: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

const toNote = (row: TeacherNoteRow): TeacherNote => ({
  id: row.id,
  text: row.text,
  pinned: row.pinned,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

// Pinned first, then newest. limit: the Home card's first few; total always
// counts every note.
export async function listNotes(
  teacherId: string,
  limit: number | null
): Promise<{ notes: TeacherNote[]; total: number }> {
  const { notes, total } = await findTeacherNotes(teacherId, limit);

  return { notes: notes.map(toNote), total };
}

export async function addNote(teacherId: string, input: CreateNoteInput): Promise<TeacherNote> {
  return toNote(await insertTeacherNote(teacherId, input.text));
}

export async function changeNote(
  teacherId: string,
  noteId: string,
  changes: UpdateNoteInput
): Promise<TeacherNote> {
  const row = await updateTeacherNote(teacherId, noteId, changes);

  if (!row) throw NoteErrors.notFound();

  return toNote(row);
}

export async function removeNote(teacherId: string, noteId: string): Promise<void> {
  if (!(await deleteTeacherNote(teacherId, noteId))) throw NoteErrors.notFound();
}
