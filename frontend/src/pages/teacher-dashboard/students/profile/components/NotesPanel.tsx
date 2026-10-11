import { useId, useState, type FormEvent } from 'react';

import LockIcon from '../../../../../components/icons/LockIcon';
import { formErrorClasses, primaryButtonClasses } from '../../../../../components/formStyles';

import { formatShortDate } from '../profileFormat';
import type { TeacherNote } from '../profileTypes';

import EmptyHint from './EmptyHint';

interface NotesPanelProps {
  notes: TeacherNote[];
  // Saves a note. Throws when the server refuses, so the form can say why.
  onAddNote: (text: string) => Promise<void>;
}

// Must match the backend's limit.
const NOTE_MAX_LENGTH = 1000;

// The teacher's private notes, newest first, and a box to add one. The
// "Private" line is part of the design, not decoration: it tells the
// teacher what parents will never see.
function NotesPanel({ notes, onAddNote }: NotesPanelProps) {
  const [text, setText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldId = useId();
  const trimmed = text.trim();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed || isSaving) return;

    setIsSaving(true);
    setError(null);

    try {
      await onAddNote(trimmed);
      setText('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t save the note.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-1.5 text-xs text-ink-muted">
        <LockIcon className="h-3.5 w-3.5" />
        Private. Never shared with parents.
      </p>

      {notes.length === 0 ? (
        <EmptyHint>
          No notes yet. Anything you write here stays between you and this page.
        </EmptyHint>
      ) : (
        <ul
          aria-label="Notes"
          className="flex flex-col gap-2.5"
        >
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex flex-col gap-1 rounded-[10px] bg-page px-3.5 py-3"
            >
              {/* pre-line keeps the line breaks the teacher typed. */}
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{note.text}</p>
              <time
                dateTime={note.createdAt}
                className="text-xs text-ink-muted"
              >
                {formatShortDate(note.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-2"
      >
        <label
          htmlFor={fieldId}
          className="text-[13px] font-semibold text-ink"
        >
          Add a note
        </label>
        <textarea
          id={fieldId}
          rows={2}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={NOTE_MAX_LENGTH}
          disabled={isSaving}
          placeholder="Only you can see this"
          className="resize-y rounded-[10px] border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary focus:ring-[3px] focus:ring-primary-tint"
        />
        {error && (
          <p
            role="alert"
            className={formErrorClasses}
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!trimmed || isSaving}
          className={`${primaryButtonClasses} self-end`}
        >
          {isSaving ? 'Saving…' : 'Save note'}
        </button>
      </form>
    </div>
  );
}

export default NotesPanel;
