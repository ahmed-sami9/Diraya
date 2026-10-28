import { useCallback, useEffect, useState } from 'react';

import { isAbortError } from '../../api/apiClient';
import {
  createMyNote,
  deleteMyNote,
  getMyNotes,
  updateMyNote,
  type MyNote,
} from '../../api/notes/notes';
import { sortNotes, topNotes } from '../../utils/myNotes';

export type MyNotesState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; notes: MyNote[]; total: number };

type Ready = Extract<MyNotesState, { status: 'ready' }>;
type Result = { key: number } & (Exclude<MyNotesState, { status: 'loading' }>);

/**
 * The teacher's notes, for the notes page (every note) or the Home card
 * (`limit`: the first few, plus `total` for "View all (23)").
 *
 * Adding and editing text wait for the server (it gives the id, and may
 * refuse the text). Pinning is optimistic: it flips at once and flips back
 * if the server says no, because a pin click should feel instant.
 */
export function useMyNotes({ limit }: { limit?: number } = {}) {
  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getMyNotes({ limit, signal: controller.signal })
      .then(({ notes, total }) =>
        setResult({ key: reloadCount, status: 'ready', notes, total })
      )
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        console.error(error);
        setResult({ key: reloadCount, status: 'error', error });
      });

    return () => controller.abort();
  }, [limit, reloadCount]);

  const state: MyNotesState =
    result === null || result.key !== reloadCount ? { status: 'loading' } : result;

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  // Applies a change to the loaded list (does nothing while loading or failed),
  // then restores the server's order (pinned first, newest) with the same
  // rule the page uses, cut to `limit` for Home. No reload needed.
  const change = useCallback(
    (apply: (ready: Ready) => Ready) =>
      setResult((previous) => {
        if (previous?.status !== 'ready') return previous;

        const next = apply(previous);

        return {
          ...previous,
          ...next,
          notes: limit === undefined ? sortNotes(next.notes, 'newest') : topNotes(next.notes, limit),
        };
      }),
    [limit]
  );

  const replaceNote = useCallback(
    (saved: MyNote) =>
      change((ready) => ({
        ...ready,
        notes: ready.notes.map((note) => (note.id === saved.id ? saved : note)),
      })),
    [change]
  );

  // Throws (ApiError) when the server refuses, so the box keeps the text and says why.
  const addNote = useCallback(
    async (text: string) => {
      const note = await createMyNote(text);
      change((ready) => ({ ...ready, notes: [note, ...ready.notes], total: ready.total + 1 }));
    },
    [change]
  );

  const editNote = useCallback(
    async (noteId: string, text: string) => {
      replaceNote(await updateMyNote(noteId, { text }));
    },
    [replaceNote]
  );

  const setPinned = useCallback(
    async (note: MyNote, pinned: boolean) => {
      replaceNote({ ...note, pinned });

      try {
        replaceNote(await updateMyNote(note.id, { pinned }));
      } catch (error) {
        replaceNote(note); // put it back the way it was
        throw error;
      }
    },
    [replaceNote]
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      await deleteMyNote(noteId);
      change((ready) => ({
        ...ready,
        notes: ready.notes.filter((note) => note.id !== noteId),
        total: ready.total - 1,
      }));
    },
    [change]
  );

  return { state, reload, addNote, editNote, setPinned, deleteNote };
}
