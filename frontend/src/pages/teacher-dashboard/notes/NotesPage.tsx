import { useId } from 'react';

import NotesIcon from '../../../components/icons/NotesIcon';
import PinIcon from '../../../components/icons/PinIcon';
import SearchIcon from '../../../components/icons/SearchIcon';

import NoteComposer from './components/NoteComposer';

// /teacher/notes
//
// The teacher's own notes: reminders about themselves, not a student.
// Layout only for now (empty state): the list, search and sort come with
// the backend. Search and sort stay disabled until there's something to find.
function NotesPage() {
  const sortId = useId();

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
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-border bg-surface px-3 text-ink-muted sm:w-64 sm:flex-none">
            <SearchIcon className="h-4 w-4 shrink-0" />
            <input
              type="search"
              placeholder="Search notes"
              aria-label="Search notes"
              disabled
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted disabled:cursor-not-allowed"
            />
          </label>

          <label htmlFor={sortId} className="sr-only">
            Sort notes
          </label>
          <select
            id={sortId}
            disabled
            className="h-10 cursor-pointer rounded-[10px] border border-border bg-surface px-2.5 text-[13px] font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </header>

      <NoteComposer variant="page" />

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
    </div>
  );
}

export default NotesPage;
