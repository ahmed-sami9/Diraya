import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';

import { formErrorClasses, primaryButtonClasses } from '../../../../components/formStyles';

import { NOTE_MAX_LENGTH } from '../notesRules';

interface NoteComposerProps {
  /** "page": a roomy box with a counter. "compact": one line, for the Home card. */
  variant: 'page' | 'compact';
  // Saves the note; throws when the server refuses, so the box keeps the
  // text and says why.
  onAdd: (text: string) => Promise<void>;
}

/** The "write a note" box. Enter saves, Shift+Enter starts a new line. */
function NoteComposer({ variant, onAdd }: NoteComposerProps) {
  const [text, setText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldId = useId();
  const trimmed = text.trim();
  const canSave = trimmed.length > 0 && !isSaving;
  const isPage = variant === 'page';

  const save = async () => {
    if (!canSave) return;

    setIsSaving(true);
    setError(null);

    try {
      await onAdd(trimmed);
      setText('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t save the note.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void save();
  };

  // Enter alone saves; Shift+Enter keeps its normal job (a new line).
  // isComposing: don't save in the middle of typing with an input method.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void save();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={
        isPage
          ? 'flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-4 sm:flex-row sm:items-end'
          : 'flex flex-col gap-2 sm:flex-row sm:items-start'
      }
    >
      <label htmlFor={fieldId} className="sr-only">
        Write a note
      </label>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <textarea
          id={fieldId}
          // field-sizing: the box grows with the text in browsers that support it.
          rows={isPage ? 2 : 1}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={NOTE_MAX_LENGTH}
          disabled={isSaving}
          placeholder={
            isPage ? 'Write a note… (Enter to save, Shift+Enter for a new line)' : 'Write a quick note…'
          }
          className={`
            w-full resize-none [field-sizing:content]
            rounded-[10px] border border-border bg-surface
            px-3.5 py-2.5 text-sm leading-relaxed text-ink
            outline-none transition-colors placeholder:text-ink-muted
            focus:border-primary focus:ring-[3px] focus:ring-primary-tint
            ${isPage ? 'min-h-[68px] max-h-60' : 'min-h-11 max-h-40'}
          `}
        />

        {isPage && (
          <span className="self-end text-xs tabular-nums text-ink-muted">
            {text.length} / {NOTE_MAX_LENGTH}
          </span>
        )}
      </div>

      <button
        type="submit"
        disabled={!canSave}
        className={`${primaryButtonClasses} shrink-0 ${isPage ? 'sm:mb-6' : ''}`}
      >
        {isSaving ? 'Saving…' : isPage ? 'Add note' : 'Add'}
      </button>

      {error && (
        <p role="alert" className={`${formErrorClasses} sm:basis-full`}>
          {error}
        </p>
      )}
    </form>
  );
}

export default NoteComposer;
