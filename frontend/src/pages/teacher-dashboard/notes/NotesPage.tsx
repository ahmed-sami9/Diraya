import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import type { MyNote } from '../../../api/notes/notes';
import SectionError from '../../../components/SectionError';
import NotesIcon from '../../../components/icons/NotesIcon';
import PinIcon from '../../../components/icons/PinIcon';
import SearchIcon from '../../../components/icons/SearchIcon';
import { useMyNotes } from '../../../hooks/notes/useMyNotes';
import { todayInCairo } from '../../../utils/cairoDate';
import {
  groupNotes,
  searchNotes,
  sortNotes,
  type NoteGroup,
  type NotesOrder,
} from '../../../utils/myNotes';

import NoteComposer from './components/NoteComposer';
import NoteRow from './components/NoteRow';
import UndoToast from './components/UndoToast';

// How long "Note deleted · Undo" waits before the note is really deleted.
const UNDO_MS = 5000;

// /teacher/notes
//
// The teacher's own notes. Everything on screen is DERIVED from one list
// (useMyNotes): search, then sort, then the date groups. Nothing is copied
// into extra state, so nothing can drift.
//
// Deleting waits UNDO_MS before calling the server: the note just hides, and
// Undo shows it again with nothing to restore. Leaving the page, or deleting
// a second note, sends the waiting delete straight away.
function NotesPage() {
  const notesData = useMyNotes();
  const { deleteNote } = notesData;

  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<NotesOrder>('newest');
  const sortId = useId();

  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<MyNote | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef<MyNote | null>(null);

  const show = (noteId: string) =>
    setHiddenIds((ids) => {
      const next = new Set(ids);
      next.delete(noteId);
      return next;
    });

  // Sends the waiting delete now. If the server refuses, the note comes back.
  const commitPending = useCallback(() => {
    const note = pendingRef.current;
    if (!note) return;

    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    pendingRef.current = null;
    setPending(null);

    deleteNote(note.id).catch((caught: unknown) => {
      show(note.id);
      setDeleteError(caught instanceof Error ? caught.message : 'Couldn’t delete the note.');
    });
  }, [deleteNote]);

  // Leaving the page doesn't cancel a delete the teacher asked for.
  useEffect(() => commitPending, [commitPending]);

  const deleteWithUndo = (note: MyNote) => {
    commitPending(); // one undo at a time: the previous delete goes through
    setDeleteError(null);
    setHiddenIds((ids) => new Set(ids).add(note.id));
    pendingRef.current = note;
    setPending(note);
    timerRef.current = window.setTimeout(commitPending, UNDO_MS);
  };

  const undo = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    const note = pendingRef.current;
    timerRef.current = null;
    pendingRef.current = null;
    setPending(null);
    if (note) show(note.id);
  };

  const ready = notesData.state.status === 'ready' ? notesData.state : null;
  const today = todayInCairo();

  const { visible, matches, groups } = useMemo(() => {
    const visible = (ready?.notes ?? []).filter((note) => !hiddenIds.has(note.id));
    const matches = sortNotes(searchNotes(visible, query), order);
    // While searching: one plain list of matches, no date groups.
    const groups: NoteGroup[] = query.trim()
      ? [{ key: 'today', label: '', notes: matches }]
      : groupNotes(matches, today);

    return { visible, matches, groups };
  }, [ready, hiddenIds, query, order, today]);

  const isSearching = query.trim().length > 0;
  const hasNotes = visible.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">My notes</h1>
          <p className="text-sm text-ink-secondary">
            Reminders for yourself. Pin the ones you need to keep in sight.
          </p>
        </div>

        <div className="flex w-full gap-2.5 sm:w-auto">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-border bg-surface px-3 text-ink-muted focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary-tint sm:w-64 sm:flex-none">
            <SearchIcon className="h-4 w-4 shrink-0" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notes"
              aria-label="Search notes"
              disabled={!hasNotes && !isSearching}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted disabled:cursor-not-allowed"
            />
          </label>

          <label htmlFor={sortId} className="sr-only">
            Sort notes
          </label>
          <select
            id={sortId}
            value={order}
            onChange={(event) => setOrder(event.target.value as NotesOrder)}
            disabled={!hasNotes}
            className="h-10 cursor-pointer rounded-[10px] border border-border bg-surface px-2.5 text-[13px] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </header>

      {notesData.state.status === 'error' ? (
        <SectionError
          title="We couldn’t load your notes"
          error={notesData.state.error}
          onRetry={notesData.reload}
        />
      ) : (
        <>
          {/* Usable while the list loads: writing a note doesn't need the list. */}
          <NoteComposer variant="page" onAdd={notesData.addNote} />

          {deleteError && (
            <p role="alert" className="rounded-lg border border-danger/20 bg-danger-tint px-4 py-3 text-sm text-danger">
              {deleteError}
            </p>
          )}

          {notesData.state.status === 'loading' ? (
            <ul aria-hidden="true" className="flex flex-col divide-y divide-border rounded-[14px] border border-border bg-surface">
              {[0, 1, 2].map((row) => (
                <li key={row} className="flex items-center gap-3 px-5 py-4">
                  <span className="h-6 w-6 animate-pulse rounded-md bg-surface-hover" />
                  <span className="h-4 flex-1 animate-pulse rounded bg-surface-hover" />
                </li>
              ))}
            </ul>
          ) : !hasNotes ? (
            <section
              aria-label="Your notes"
              className="flex flex-col items-center rounded-[14px] border border-dashed border-border-strong bg-surface px-6 py-12 text-center"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-tint text-primary">
                <NotesIcon className="h-7 w-7" />
              </span>
              <h2 className="mt-4 text-base font-bold text-ink">No notes yet</h2>
              <p className="mt-1 max-w-sm text-sm text-ink-secondary">
                Things to print, people to call, ideas for next week. Write them above and they’ll be
                waiting here.
              </p>
              <p className="mt-4 flex items-center gap-1.5 text-[13px] text-ink-muted">
                <PinIcon className="h-4 w-4" />
                Pin a note to keep it at the top.
              </p>
            </section>
          ) : matches.length === 0 ? (
            <p className="rounded-[14px] border border-border bg-surface px-5 py-8 text-center text-sm text-ink-secondary">
              No notes match “{query.trim()}”.
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {isSearching && (
                <p aria-live="polite" className="text-[13px] text-ink-muted">
                  {matches.length} of {visible.length} notes match “{query.trim()}”
                </p>
              )}

              {groups.map((group) => (
                <section key={group.key} aria-label={group.label || 'Search results'}>
                  {group.label && (
                    <h2 className="mb-2 flex items-center gap-2 px-0.5 text-xs font-bold uppercase tracking-wider text-ink-muted">
                      {group.label}
                      <span className="rounded-full bg-border/70 px-2 py-px text-[11px] font-semibold">
                        {group.notes.length}
                      </span>
                    </h2>
                  )}
                  <ul className="divide-y divide-border rounded-[14px] border border-border bg-surface">
                    {group.notes.map((note) => (
                      <NoteRow
                        key={note.id}
                        note={note}
                        query={query}
                        onSetPinned={notesData.setPinned}
                        onEdit={notesData.editNote}
                        onDelete={deleteWithUndo}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {pending && <UndoToast message="Note deleted" onUndo={undo} onClose={commitPending} />}
    </div>
  );
}

export default NotesPage;
