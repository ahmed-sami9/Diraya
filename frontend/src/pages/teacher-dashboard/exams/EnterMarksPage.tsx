import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import type { Exam, ExamResultInput, ExamResultRow } from '../../../api/exams/exams';
import SectionError from '../../../components/SectionError';
import {
  formErrorClasses,
  inputClasses,
  primaryButtonClasses,
} from '../../../components/formStyles';
import { useExam } from '../../../hooks/exams/useExam';
import { useDelayedFlag } from '../../../hooks/useDelayedFlag';
import { todayInCairo } from '../../../utils/cairoDate';
import DiscardChangesDialog from '../attendance/components/DiscardChangesDialog';

import MarkEntryRow, { type MarkEntry } from './components/MarkEntryRow';
import { asDate, examPath, formatMark, shortDay } from './examHelpers';

/* --------------------------------- Rules ---------------------------------- */

// What a saved result looks like in the box.
const savedEntry = (row: ExamResultRow): MarkEntry =>
  row.status === 'absent'
    ? { absent: true, text: '' }
    : { absent: false, text: row.score === null ? '' : formatMark(row.score) };

const sameEntry = (a: MarkEntry, b: MarkEntry) =>
  a.absent === b.absent && a.text.trim() === b.text.trim();

// The box's text -> a mark, or null when it isn't one.
const parseMark = (text: string) => {
  const trimmed = text.trim();
  return /^\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : null;
};

// One message per problem, in the teacher's words. An empty box is fine: it
// means "not entered yet", and Save leaves it that way.
function entryError(entry: MarkEntry, exam: Exam): string | null {
  if (entry.absent || entry.text.trim() === '') return null;

  const mark = parseMark(entry.text);
  if (mark === null) return 'Type a number, like 31.5.';
  if (!Number.isInteger(mark * 2)) return 'Use whole or half marks, like 31.5.';
  if (mark > exam.maxMark) return `The highest mark is ${exam.maxMark}.`;
  return null;
}

// The entry as the server wants it.
const toResultInput = (studentId: string, entry: MarkEntry): ExamResultInput =>
  entry.absent
    ? { studentId, status: 'absent', score: null }
    : entry.text.trim() === ''
      ? { studentId, status: 'not-entered', score: null }
      : { studentId, status: 'scored', score: Number(entry.text.trim()) };

/* ---------------------------------- Page ---------------------------------- */

// /teacher/exams/:examId/marks?group=6
//
// Marks for one group at a time: the pile of papers in the teacher's hand.
// Type a mark (Enter jumps to the next student), or tap A for absent. Save
// sends only the students that changed.
//
// State is kept small on purpose: the server's rows are the truth, and
// `edits` holds ONLY what the teacher changed since the last save. What a
// box shows is derived: edits[id] ?? the saved value. So there is no copy of
// the server data to keep in sync, and "unsaved changes" is just "edits
// isn't empty".
function EnterMarksPage() {
  const { examId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = todayInCairo();

  const { state, reload, saveResults } = useExam(examId);
  const detail = state.status === 'ready' ? state.detail : null;

  const [edits, setEdits] = useState<Record<string, MarkEntry>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  // Where the teacher asked to go while having unsaved marks.
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);

  const listRef = useRef<HTMLUListElement>(null);

  // The groups that have students on this exam, with how many are left.
  const groups = useMemo(() => {
    if (!detail) return [];

    return detail.groups
      .map((group) => {
        const rows = detail.results
          .filter((row) => row.group.id === group.id)
          .sort((a, b) => a.student.name.localeCompare(b.student.name));

        return {
          ...group,
          rows,
          left: rows.filter((row) => row.status === 'not-entered').length,
        };
      })
      .filter((group) => group.rows.length > 0);
  }, [detail]);

  // ?group= when it's valid; otherwise the first group with work left;
  // otherwise the first group.
  const groupParam = searchParams.get('group');
  const group =
    groups.find((item) => item.id === groupParam) ??
    groups.find((item) => item.left > 0) ??
    groups[0] ??
    null;

  const isDirty = Object.keys(edits).length > 0;

  // The default group depends on which groups have work left, which changes
  // when marks are saved. Once the teacher starts on a group, write it into
  // the URL so the page can't jump to another group under their hands.
  const pinGroup = () => {
    if (group && groupParam !== group.id) {
      setSearchParams({ group: group.id }, { replace: true });
    }
  };

  // Closing the tab or reloading with unsaved marks: the browser asks first.
  useEffect(() => {
    if (!isDirty) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);

    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  /* ------------------------------ Derived rows ----------------------------- */

  const rows = useMemo(() => {
    if (!detail || !group) return [];

    return group.rows.map((row) => {
      const saved = savedEntry(row);
      const entry = edits[row.student.id] ?? saved;

      return {
        row,
        entry,
        error: entryError(entry, detail.exam),
        isChanged: !sameEntry(entry, saved),
      };
    });
  }, [detail, group, edits]);

  const counts = useMemo(() => {
    let entered = 0;
    let absent = 0;
    let left = 0;
    let invalid = 0;

    for (const { entry, error } of rows) {
      if (error) invalid += 1;
      else if (entry.absent) absent += 1;
      else if (entry.text.trim() === '') left += 1;
      else entered += 1;
    }

    return { entered, absent, left, invalid };
  }, [rows]);

  /* -------------------------------- Actions -------------------------------- */

  const setEntry = (row: ExamResultRow, entry: MarkEntry) => {
    pinGroup();
    setJustSaved(false);
    setSaveError(null);
    setEdits((previous) => {
      const next = { ...previous };
      // Typed back to what's saved: it's no longer a change.
      if (sameEntry(entry, savedEntry(row))) delete next[row.student.id];
      else next[row.student.id] = entry;
      return next;
    });
  };

  const goToGroup = (groupId: string) => {
    setEdits({});
    setSaveError(null);
    setJustSaved(false);
    setSearchParams({ group: groupId }, { replace: true });
  };

  const requestGroup = (groupId: string) => {
    if (groupId === group?.id) return;

    if (isDirty) setPendingGroupId(groupId);
    else goToGroup(groupId);
  };

  // Enter in a box: focus the next box down (absent rows have none).
  const focusNext = (studentId: string) => {
    const inputs = Array.from(
      listRef.current?.querySelectorAll<HTMLInputElement>('[data-mark-input]') ?? []
    );
    const index = inputs.findIndex((input) => input.id === `mark-${studentId}`);
    inputs[index + 1]?.focus();
  };

  const save = async () => {
    if (isSaving || !isDirty) return;

    // Fix first, then save: focus the first box with a problem.
    const firstInvalid = rows.find((item) => item.error);
    if (firstInvalid) {
      document.getElementById(`mark-${firstInvalid.row.student.id}`)?.focus();
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Only the changed students. Two devices entering marks for the same
      // group can't overwrite each other's untouched rows this way.
      await saveResults(
        rows
          .filter((item) => item.isChanged)
          .map((item) => toResultInput(item.row.student.id, item.entry))
      );
      setEdits({});
      setJustSaved(true);
    } catch (error) {
      console.error(error);
      setSaveError(
        error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  /* --------------------------------- States -------------------------------- */

  if (state.status === 'not-found') {
    return (
      <PageFrame
        backTo="/teacher/exams"
        backLabel="Exams & marks"
      >
        <Notice
          title="This exam doesn’t exist any more"
          text="It may have been deleted, or the link is old."
        />
      </PageFrame>
    );
  }

  if (state.status === 'error') {
    return (
      <PageFrame
        backTo="/teacher/exams"
        backLabel="Exams & marks"
      >
        <SectionError
          title="We couldn’t load this exam"
          error={state.error}
          onRetry={reload}
        />
      </PageFrame>
    );
  }

  if (!detail) {
    return (
      <PageFrame
        backTo="/teacher/exams"
        backLabel="Exams & marks"
      >
        <MarksSkeleton />
      </PageFrame>
    );
  }

  const { exam } = detail;
  const backTo = `${examPath(exam.id)}${group ? `?group=${group.id}` : ''}`;

  // Marks for an exam that hasn't happened can only be mistakes.
  if (exam.heldOn > today) {
    return (
      <PageFrame
        backTo={backTo}
        backLabel={exam.title}
      >
        <Notice
          title={`${exam.title} is on ${shortDay.format(asDate(exam.heldOn))}`}
          text="You can enter marks from the exam day."
        />
      </PageFrame>
    );
  }

  if (!group) {
    return (
      <PageFrame
        backTo={backTo}
        backLabel={exam.title}
      >
        <Notice
          title="No students on this exam"
          text={`Add students to ${exam.grade.name} first.`}
        />
      </PageFrame>
    );
  }

  // After a save: the next group that still has work, if any.
  const nextGroup = justSaved ? groups.find((item) => item.id !== group.id && item.left > 0) : null;

  return (
    <PageFrame
      backTo={backTo}
      backLabel={exam.title}
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Enter marks</h1>
        <p className="text-sm text-ink-secondary">
          {exam.title} · out of {exam.maxMark}. Type a mark or tap <strong>A</strong> for absent;
          Enter jumps to the next student.
        </p>
      </header>

      {groups.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="marks-group"
            className="text-xs font-semibold uppercase tracking-wide text-ink-muted"
          >
            Group
          </label>
          <select
            id="marks-group"
            value={group.id}
            onChange={(event) => requestGroup(event.target.value)}
            disabled={isSaving}
            className={`${inputClasses(false)} cursor-pointer font-semibold`}
          >
            {groups.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.name} · {item.rows.length} students
                {item.left > 0 ? ` · ${item.left} left` : ' · done'}
              </option>
            ))}
          </select>
        </div>
      )}

      <section
        aria-label={`Marks for ${group.name}`}
        className="rounded-2xl border border-border bg-surface"
      >
        <ul
          ref={listRef}
          aria-label="Marks"
        >
          {rows.map(({ row, entry, error, isChanged }) => (
            <MarkEntryRow
              key={row.student.id}
              row={row}
              entry={entry}
              maxMark={exam.maxMark}
              error={error}
              isChanged={isChanged}
              disabled={isSaving}
              onChange={(next) => setEntry(row, next)}
              onEnter={() => focusNext(row.student.id)}
            />
          ))}
        </ul>

        {/* Sticks to the bottom of the screen: Save is always one tap away. */}
        <div className="sticky bottom-0 z-10 border-t border-border-strong bg-surface/95 px-4 py-3 backdrop-blur sm:rounded-b-2xl sm:px-5">
          {saveError && (
            <p
              role="alert"
              className={`${formErrorClasses} mb-3`}
            >
              {saveError}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p
              aria-live="polite"
              className="text-sm font-semibold tabular-nums text-ink-secondary"
            >
              {counts.entered} entered · {counts.absent} absent
              {counts.left > 0 && <span className="text-warning"> · {counts.left} left</span>}
              {counts.invalid > 0 && (
                <span className="text-danger"> · {counts.invalid} to fix</span>
              )}
              {justSaved && <span className="font-medium text-success"> · Saved</span>}
              {isDirty && <span className="font-medium text-warning"> · Unsaved changes</span>}
            </p>

            <button
              type="button"
              onClick={save}
              disabled={!isDirty || isSaving}
              aria-busy={isSaving}
              className={`${primaryButtonClasses} min-w-[140px] flex-1 sm:flex-none`}
            >
              {isSaving ? 'Saving…' : 'Save marks'}
            </button>
          </div>

          {/* The next step after a save, so the teacher doesn't have to hunt. */}
          {justSaved && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
              {nextGroup && (
                <button
                  type="button"
                  onClick={() => goToGroup(nextGroup.id)}
                  className="cursor-pointer text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Next: {nextGroup.name} ({nextGroup.left} left) →
                </button>
              )}
              <Link
                to={backTo}
                className="text-ink-secondary hover:text-primary hover:underline"
              >
                See the results
              </Link>
            </div>
          )}
        </div>
      </section>

      {pendingGroupId && (
        <DiscardChangesDialog
          onKeep={() => setPendingGroupId(null)}
          onDiscard={() => {
            goToGroup(pendingGroupId);
            setPendingGroupId(null);
          }}
        />
      )}
    </PageFrame>
  );
}

// Narrow on purpose: it's a list of names and boxes, used mostly on a phone.
function PageFrame({
  backTo,
  backLabel,
  children,
}: {
  backTo: string;
  backLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
      <Link
        to={backTo}
        className="flex w-fit items-center gap-1 text-sm font-semibold text-ink-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span aria-hidden="true">←</span> {backLabel}
      </Link>
      {children}
    </div>
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <section className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-6 py-12 text-center">
      <h1 className="text-lg font-bold text-ink">{title}</h1>
      <p className="max-w-sm text-sm text-ink-secondary">{text}</p>
    </section>
  );
}

// Only after a short delay, so a fast answer never flashes it.
function MarksSkeleton() {
  const isVisible = useDelayedFlag(true);

  if (!isVisible) return null;

  return (
    <div
      role="status"
      className="flex animate-pulse flex-col gap-4"
    >
      <span className="sr-only">Loading</span>
      <div className="h-14 rounded-2xl bg-surface" />
      <div className="h-[420px] rounded-2xl border border-border bg-surface" />
    </div>
  );
}

export default EnterMarksPage;
