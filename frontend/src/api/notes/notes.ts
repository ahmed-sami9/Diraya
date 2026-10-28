import { apiRequest } from '../apiClient';

// The teacher's own notes (My notes): reminders about themselves, not a
// student. Student notes live in api/students/profile.ts.
//
// Backend endpoints (backend/src/modules/notes, not built yet):
//
//   GET    /teacher/notes                 -> 200 { notes: MyNote[], total }
//   GET    /teacher/notes?limit=5         -> 200 { notes: MyNote[], total }  (Home card)
//   POST   /teacher/notes                 -> 201 { note: MyNote }
//   PATCH  /teacher/notes/:noteId         -> 200 { note: MyNote }   edit text and/or pin
//   DELETE /teacher/notes/:noteId         -> 204
//
// The list always comes pinned first, then newest first. `total` counts every
// note even when `limit` cuts the list, so Home can say "View all (23)".
//
// Error codes the server sends back (read them from ApiError.code):
//
//   INVALID_INPUT    400  empty text, more than 1000 characters, unknown fields
//   NOTE_NOT_FOUND   404  no note with this id for this teacher

export type MyNote = {
  id: string;
  text: string;
  pinned: boolean;
  // ISO timestamps. Editing changes updatedAt only, so a note never jumps
  // in the date order because it was fixed.
  createdAt: string;
  updatedAt: string;
};

export type MyNotesList = {
  notes: MyNote[];
  total: number;
};

// One PATCH for both edits: change the text, pin/unpin, or both.
export type MyNoteChanges = {
  text?: string;
  pinned?: boolean;
};

const enc = encodeURIComponent;

export function getMyNotes(
  { limit, signal }: { limit?: number; signal?: AbortSignal } = {}
): Promise<MyNotesList> {
  const query = limit === undefined ? '' : `?limit=${limit}`;

  return apiRequest<MyNotesList>('GET', `/teacher/notes${query}`, { signal });
}

export async function createMyNote(text: string): Promise<MyNote> {
  const data = await apiRequest<{ note: MyNote }>('POST', '/teacher/notes', { body: { text } });

  return data.note;
}

export async function updateMyNote(noteId: string, changes: MyNoteChanges): Promise<MyNote> {
  const data = await apiRequest<{ note: MyNote }>('PATCH', `/teacher/notes/${enc(noteId)}`, {
    body: changes,
  });

  return data.note;
}

export async function deleteMyNote(noteId: string): Promise<void> {
  await apiRequest<null>('DELETE', `/teacher/notes/${enc(noteId)}`);
}
