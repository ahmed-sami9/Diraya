import { Link } from 'react-router-dom';

import Card from '../../../../components/Card';
import EmptyState from '../../../../components/EmptyState';
import NotesIcon from '../../../../components/icons/NotesIcon';
import PinIcon from '../../../../components/icons/PinIcon';
import { useMyNotes } from '../../../../hooks/notes/useMyNotes';
import { noteWhen } from '../../../../utils/myNotes';

import NoteComposer from '../../notes/components/NoteComposer';
import { HOME_NOTES_SHOWN } from '../../notes/notesRules';

const viewAllClasses = `
  rounded-md text-[13px] font-semibold text-primary hover:underline
  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
`;

/**
 * My notes on Home: a quick box to add one, then pinned notes first and the
 * newest after. Pin, edit and delete live on the notes page, so this card
 * stays calm; clicking a note opens the page.
 */
function NotesCard() {
  const { state, addNote, reload } = useMyNotes({ limit: HOME_NOTES_SHOWN });

  return (
    <Card
      title="My notes"
      action={
        <Link to="/teacher/notes" className={viewAllClasses}>
          {state.status === 'ready' && state.total > 0 ? `View all (${state.total})` : 'View all'}
        </Link>
      }
    >
      <div className="border-b border-border px-5 py-4">
        <NoteComposer variant="compact" onAdd={addNote} />
      </div>

      {state.status === 'loading' ? (
        <ul aria-hidden="true" className="divide-y divide-border">
          {[0, 1].map((row) => (
            <li key={row} className="flex items-center gap-3 px-5 py-4">
              <span className="h-4 flex-1 animate-pulse rounded bg-surface-hover" />
            </li>
          ))}
        </ul>
      ) : state.status === 'error' ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-5 py-5">
          <p className="text-sm text-ink-secondary">We couldn’t load your notes.</p>
          <button
            type="button"
            onClick={reload}
            className="flex h-10 cursor-pointer items-center rounded-[10px] border border-border bg-surface px-3.5 text-[13px] font-semibold text-ink hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Try again
          </button>
        </div>
      ) : state.notes.length === 0 ? (
        <EmptyState
          icon={<NotesIcon className="h-6 w-6" />}
          title="No notes yet"
          description="Reminders for yourself, like things to print or people to call, will show here."
        />
      ) : (
        <ul className="divide-y divide-border">
          {state.notes.map((note) => (
            <li key={note.id}>
              <Link
                to="/teacher/notes"
                className={`
                  flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-surface-hover
                  focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary
                  ${note.pinned ? 'bg-primary-tint/25' : ''}
                `}
              >
                {/* Same width for every row, so the text lines up. */}
                <span className="mt-0.5 flex w-4 shrink-0 justify-center text-primary">
                  {note.pinned && (
                    <>
                      <PinIcon filled className="h-4 w-4" />
                      <span className="sr-only">Pinned: </span>
                    </>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  {/* Two lines at most here; the full note is on the page. */}
                  <span className="line-clamp-2 whitespace-pre-line break-words text-sm text-ink">
                    {note.text}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-muted">{noteWhen(note)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default NotesCard;
