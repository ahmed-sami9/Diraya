import type { KeyboardEvent } from 'react';

import type { ExamResultRow } from '../../../../api/exams/exams';

// What the teacher has typed for one student: a box of text, or "absent".
// Kept as text (not a number) until Save, so "31." mid-typing isn't lost.
export type MarkEntry = { absent: boolean; text: string };

interface MarkEntryRowProps {
  row: ExamResultRow;
  entry: MarkEntry;
  maxMark: number;
  // Already worked out by the page; null when the box is fine.
  error: string | null;
  isChanged: boolean;
  disabled: boolean;
  onChange: (entry: MarkEntry) => void;
  // Enter in the box: jump to the next student, like a paper list.
  onEnter: () => void;
}

// One student on the marks list: name, the box, and an "A" (absent) toggle.
//
// Absent is a toggle next to the box, not a word typed into it: one tap on
// a phone, and it can't be confused with a mark.
function MarkEntryRow({
  row,
  entry,
  maxMark,
  error,
  isChanged,
  disabled,
  onChange,
  onEnter,
}: MarkEntryRowProps) {
  const inputId = `mark-${row.student.id}`;
  const errorId = `${inputId}-error`;

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      // Enter would submit nothing useful here; it moves on instead.
      event.preventDefault();
      onEnter();
    }
  };

  return (
    <li className="flex flex-col gap-1.5 border-b border-border-strong px-4 py-2.5 last:border-b-0 sm:px-5">
      <div className="flex items-center gap-2.5">
        <label
          htmlFor={entry.absent ? undefined : inputId}
          className="flex min-w-0 flex-1 flex-col"
        >
          <span className="truncate text-[15px] font-semibold text-ink">
            {row.student.name}
            {/* A dot marks rows changed since the last save. */}
            {isChanged && (
              <span
                aria-label=" (changed)"
                className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle"
              />
            )}
          </span>
          <span className="font-mono text-xs text-ink-muted">{row.student.code}</span>
        </label>

        {entry.absent ? (
          <span className="flex h-11 w-[104px] items-center justify-center rounded-[10px] bg-page text-sm font-bold text-ink-secondary">
            Absent
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <input
              id={inputId}
              data-mark-input
              type="text"
              // The phone shows a number pad with a decimal point.
              inputMode="decimal"
              enterKeyHint="next"
              autoComplete="off"
              value={entry.text}
              placeholder="—"
              disabled={disabled}
              onChange={(event) => onChange({ absent: false, text: event.target.value })}
              onKeyDown={handleKeyDown}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              className={`
                h-11 w-16 rounded-[10px] px-2.5 text-right
                text-base font-bold tabular-nums text-ink
                outline-none transition-colors focus:ring-[3px]
                disabled:bg-surface-hover
                ${
                  error
                    ? 'border-2 border-danger bg-danger-tint focus:ring-danger-tint'
                    : 'border border-border-strong bg-surface focus:border-primary focus:ring-primary-tint'
                }
              `}
            />
            <span
              aria-hidden="true"
              className="w-8 text-sm text-ink-muted"
            >
              / {maxMark}
            </span>
          </span>
        )}

        <button
          type="button"
          aria-label={`Absent: ${row.student.name}`}
          aria-pressed={entry.absent}
          disabled={disabled}
          // Leaving "absent" starts from an empty box, not the old mark.
          onClick={() => onChange({ absent: !entry.absent, text: '' })}
          className={`
            h-11 w-11 shrink-0 rounded-[10px] text-sm font-bold
            cursor-pointer transition-colors
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
            disabled:cursor-not-allowed disabled:opacity-60
            ${
              entry.absent
                ? 'bg-ink-secondary text-white'
                : 'border border-border bg-surface text-ink-secondary hover:bg-surface-hover'
            }
          `}
        >
          A
        </button>
      </div>

      {error && (
        <p
          id={errorId}
          className="text-xs font-semibold text-danger"
        >
          {error}
        </p>
      )}
    </li>
  );
}

export default MarkEntryRow;
