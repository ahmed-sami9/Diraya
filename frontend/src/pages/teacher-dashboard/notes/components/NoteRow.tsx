import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from 'react';

import OptionsMenu from '../../../../components/OptionsMenu';
import { formErrorClasses } from '../../../../components/formStyles';
import MoreHorizontalIcon from '../../../../components/icons/MoreHorizontalIcon';
import PencilIcon from '../../../../components/icons/PencilIcon';
import PinIcon from '../../../../components/icons/PinIcon';
import TrashIcon from '../../../../components/icons/TrashIcon';
import type { MyNote } from '../../../../api/notes/notes';
import { noteWhen } from '../../../../utils/myNotes';

import { NOTE_MAX_LENGTH } from '../notesRules';

interface NoteRowProps {
  note: MyNote;
  // The search, so matching words can be highlighted.
  query: string;
  // Each throws (ApiError) when the server refuses.
  onSetPinned: (note: MyNote, pinned: boolean) => Promise<void>;
  onEdit: (noteId: string, text: string) => Promise<void>;
  onDelete: (note: MyNote) => void;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Wraps each searched word in <mark>, so you can see why a note matched.
function highlight(text: string, query: string): ReactNode {
  const words = query.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (words.length === 0) return text;

  const pattern = new RegExp(`(${words.join('|')})`, 'giu');

  return text.split(pattern).map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} className="rounded-[3px] bg-warning-tint px-0.5 text-ink">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

/** One note: its pin, text and date, a ⋯ menu, and editing in place. */
function NoteRow({ note, query, onSetPinned, onEdit, onDelete }: NoteRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();

  // A failed pin explains itself briefly, then gets out of the way.
  useEffect(() => {
    if (!error || isEditing) return;
    const timer = window.setTimeout(() => setError(null), 4000);
    return () => window.clearTimeout(timer);
  }, [error, isEditing]);

  const startEditing = () => {
    setDraft(note.text);
    setError(null);
    setIsEditing(true);
  };

  const togglePin = () => {
    setError(null);
    onSetPinned(note, !note.pinned).catch((caught: unknown) =>
      setError(caught instanceof Error ? caught.message : 'Couldn’t update the note.')
    );
  };

  const save = async () => {
    const text = draft.trim();
    if (!text || isSaving) return;

    // Nothing changed: just close, no request.
    if (text === note.text) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onEdit(note.id, text);
      setIsEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t save the note.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      setIsEditing(false);
      setError(null);
    } else if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void save();
    }
  };

  return (
    <li
      className={`flex items-start gap-3 px-4 py-3.5 sm:px-5 ${
        isEditing ? 'bg-primary-tint/60' : note.pinned ? 'bg-primary-tint/25' : ''
      }`}
    >
      {/* The pin itself is the button: solid = pinned, outline = not. */}
      <button
        type="button"
        onClick={togglePin}
        aria-pressed={note.pinned}
        aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
        title={note.pinned ? 'Unpin' : 'Pin to top'}
        className={`
          mt-0.5 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg
          transition-colors hover:bg-surface-hover
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
          ${note.pinned ? 'text-primary' : 'text-ink-muted/70 hover:text-ink-secondary'}
        `}
      >
        <PinIcon filled={note.pinned} className="h-[18px] w-[18px]" />
      </button>

      <div className="min-w-0 flex-1">
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={fieldId} className="sr-only">
              Edit note
            </label>
            <textarea
              id={fieldId}
              autoFocus
              rows={2}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={NOTE_MAX_LENGTH}
              disabled={isSaving}
              className="
                w-full resize-none [field-sizing:content] min-h-[60px] max-h-60
                rounded-[10px] border-[1.5px] border-primary bg-surface
                px-3 py-2.5 text-sm leading-relaxed text-ink outline-none
                focus:ring-[3px] focus:ring-primary-tint
              "
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-1 text-xs text-ink-muted">Enter to save · Esc to cancel</span>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setError(null);
                }}
                className="h-9 cursor-pointer rounded-[10px] border border-border bg-surface px-3 text-[13px] font-semibold text-ink hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={!draft.trim() || isSaving}
                className="h-9 cursor-pointer rounded-[10px] bg-primary-solid px-3.5 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* pre-line keeps the line breaks the teacher typed. */}
            <p className="whitespace-pre-line break-words text-sm leading-relaxed text-ink">
              {highlight(note.text, query)}
            </p>
            <time dateTime={note.createdAt} className="mt-0.5 block text-xs text-ink-muted">
              {noteWhen(note)}
            </time>
          </>
        )}

        {error && (
          <p role="alert" className={`${formErrorClasses} mt-2`}>
            {error}
          </p>
        )}
      </div>

      {!isEditing && (
        <OptionsMenu
          label="Note options"
          trigger={<MoreHorizontalIcon className="h-[18px] w-[18px]" />}
          buttonClassName="h-8 w-8 justify-center rounded-lg text-ink-muted hover:bg-surface-hover hover:text-ink"
          items={[
            {
              label: note.pinned ? 'Unpin' : 'Pin to top',
              icon: <PinIcon filled={!note.pinned} className="h-4 w-4 text-ink-secondary" />,
              onSelect: togglePin,
            },
            {
              label: 'Edit',
              icon: <PencilIcon className="h-4 w-4 text-ink-secondary" />,
              onSelect: startEditing,
            },
            {
              label: 'Delete',
              icon: <TrashIcon className="h-4 w-4" />,
              tone: 'danger',
              onSelect: () => onDelete(note),
            },
          ]}
        />
      )}
    </li>
  );
}

export default NoteRow;
