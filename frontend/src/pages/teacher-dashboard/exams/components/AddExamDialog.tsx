import { useId, useRef, useState, type FormEvent } from 'react';

import type { GradeSummary } from '../../../../api/students/grades';
import DialogShell from '../../../../components/DialogShell';
import {
  formErrorClasses,
  inputClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from '../../../../components/formStyles';
import { isValidIsoDay } from '../../../../utils/cairoDate';
import type { ExamInput, ExamKind } from '../ExamsPage';

interface AddExamDialogProps {
  grades: GradeSummary[];
  // The grade the list is filtered to, if any: the likeliest choice.
  defaultGradeId: string | null;
  today: string;
  // Throws if it fails, so the dialog can show why.
  onSubmit: (input: ExamInput) => Promise<void>;
  onClose: () => void;
}

// Must match the limits the backend will enforce.
const TITLE_MAX_LENGTH = 80;
const MAX_MARK_LIMIT = 1000;

type Field = 'title' | 'heldOn' | 'maxMark' | 'passMark';
type FieldErrors = Partial<Record<Field, string>>;

// "31.5" -> 31.5 ; "", "abc", "1e3" -> null. Typed as text (not
// type="number") so the browser can't silently turn "3o" into "".
const parseMark = (value: string) => {
  const trimmed = value.trim();
  return /^\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : null;
};

const isHalfStep = (value: number) => Number.isInteger(value * 2);

// Every rule in one pure function: easy to read, easy to unit-test, and the
// same order the fields appear in, so the first error is the first field.
function validate(values: { title: string; heldOn: string; maxMark: string; passMark: string }): {
  errors: FieldErrors;
  maxMark: number;
  passMark: number;
} {
  const errors: FieldErrors = {};
  const title = values.title.trim();
  const maxMark = parseMark(values.maxMark);
  const passMark = parseMark(values.passMark);

  if (!title) errors.title = 'Give the exam a name.';
  else if (title.length > TITLE_MAX_LENGTH)
    errors.title = `Keep the name under ${TITLE_MAX_LENGTH} characters.`;

  if (!isValidIsoDay(values.heldOn)) errors.heldOn = 'Pick the day of the exam.';

  if (maxMark === null || !Number.isInteger(maxMark) || maxMark < 1 || maxMark > MAX_MARK_LIMIT)
    errors.maxMark = `A whole number from 1 to ${MAX_MARK_LIMIT}.`;

  if (passMark === null || !isHalfStep(passMark)) errors.passMark = 'A mark like 20 or 20.5.';
  else if (maxMark !== null && !errors.maxMark && (passMark <= 0 || passMark > maxMark))
    errors.passMark = `More than 0, up to ${maxMark}.`;

  return { errors, maxMark: maxMark ?? 0, passMark: passMark ?? 0 };
}

// "Add exam": the details an exam needs before anyone sits it. Marks are
// entered later, from the exam's own page.
function AddExamDialog({ grades, defaultGradeId, today, onSubmit, onClose }: AddExamDialogProps) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ExamKind>('exam');
  const [gradeId, setGradeId] = useState(defaultGradeId ?? grades[0]?.id ?? '');
  const [heldOn, setHeldOn] = useState(today);
  const [maxMark, setMaxMark] = useState('20');
  // null = "not touched": the pass mark follows half of "Out of". Once the
  // teacher types their own, it stops following. Derived, not synced by an
  // effect: there's never a moment where the two disagree.
  const [customPassMark, setCustomPassMark] = useState<string | null>(null);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const parsedMax = parseMark(maxMark);
  const passMark = customPassMark ?? (parsedMax === null ? '' : String(parsedMax / 2));

  const requestClose = () => {
    if (!isSaving) onClose();
  };

  // Editing a field clears its error: the message described the old value.
  const clearError = (field: Field) => {
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSaving) return;

    const result = validate({ title, heldOn, maxMark, passMark });

    // Object keys keep insertion order, and validate() checks the fields
    // top to bottom, so the first key is the first field on screen.
    const firstInvalid = Object.keys(result.errors)[0] as Field | undefined;

    if (firstInvalid) {
      setErrors(result.errors);
      // Focus it, so keyboard and screen reader users land on what needs
      // fixing. By id, because the new aria-invalid isn't rendered yet.
      document.getElementById(`${id}-${firstInvalid}`)?.focus();
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      await onSubmit({
        title: title.trim(),
        kind,
        gradeId,
        heldOn,
        maxMark: result.maxMark,
        passMark: result.passMark,
      });
      onClose();
    } catch (error) {
      console.error(error);
      setFormError(
        error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      );
      setIsSaving(false);
    }
  };

  // Label, input and error wired together: aria-describedby makes the
  // screen reader read the error (or hint) right after the field.
  const fieldProps = (field: Field) => ({
    id: `${id}-${field}`,
    disabled: isSaving,
    'aria-invalid': Boolean(errors[field]),
    'aria-describedby': errors[field] ? `${id}-${field}-error` : undefined,
    className: inputClasses(Boolean(errors[field])),
  });

  // A plain function, not a component: a component defined inside another
  // is a new type on every render, so React would remount it each time.
  const fieldError = (field: Field) =>
    errors[field] ? (
      <p
        id={`${id}-${field}-error`}
        className="text-[13px] text-danger"
      >
        {errors[field]}
      </p>
    ) : null;

  const labelClasses = 'text-sm font-semibold text-ink';

  return (
    <DialogShell
      title="Add exam"
      description="For a whole grade. You enter marks group by group after it’s held."
      onRequestClose={requestClose}
      isBusy={isSaving}
      initialFocusRef={titleRef}
    >
      <form
        noValidate
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
      >
        {formError && (
          <p
            role="alert"
            className={formErrorClasses}
          >
            {formError}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${id}-title`}
            className={labelClasses}
          >
            Name
          </label>
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              clearError('title');
            }}
            placeholder="e.g. Unit 4 test"
            autoComplete="off"
            {...fieldProps('title')}
          />
          {fieldError('title')}
        </div>

        {/* Real radio buttons, styled as two big tiles: arrow keys, one
            choice at a time and screen reader support come for free. */}
        <fieldset
          disabled={isSaving}
          className="flex flex-col gap-1.5"
        >
          <legend className={`${labelClasses} mb-1.5`}>Type</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['exam', 'quiz'] as const).map((option) => (
              <label
                key={option}
                className={`
                  flex h-11 cursor-pointer items-center justify-center gap-2
                  rounded-[10px] border text-sm transition-colors
                  has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary
                  ${
                    kind === option
                      ? 'border-primary bg-primary-tint font-bold text-primary'
                      : 'border-border font-semibold text-ink hover:bg-surface-hover'
                  }
                `}
              >
                <input
                  type="radio"
                  name={`${id}-kind`}
                  value={option}
                  checked={kind === option}
                  onChange={() => setKind(option)}
                  className="accent-primary"
                />
                {option === 'exam' ? 'Exam' : 'Quiz'}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Two columns from small screens up, stacked on narrow phones. */}
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`${id}-grade`}
              className={labelClasses}
            >
              Grade
            </label>
            <select
              id={`${id}-grade`}
              value={gradeId}
              onChange={(event) => setGradeId(event.target.value)}
              disabled={isSaving}
              className={inputClasses(false)}
            >
              {grades.map((grade) => (
                <option
                  key={grade.id}
                  value={grade.id}
                >
                  {grade.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`${id}-heldOn`}
              className={labelClasses}
            >
              Date
            </label>
            {/* Past days are allowed: a teacher may record an exam they
                already held on paper. */}
            <input
              type="date"
              value={heldOn}
              onChange={(event) => {
                setHeldOn(event.target.value);
                clearError('heldOn');
              }}
              {...fieldProps('heldOn')}
            />
            {fieldError('heldOn')}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 sm:gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`${id}-maxMark`}
              className={labelClasses}
            >
              Out of
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={maxMark}
              onChange={(event) => {
                setMaxMark(event.target.value);
                clearError('maxMark');
                // The pass mark may follow it, so its old error is stale too.
                if (customPassMark === null) clearError('passMark');
              }}
              {...fieldProps('maxMark')}
            />
            {fieldError('maxMark')}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`${id}-passMark`}
              className={labelClasses}
            >
              Pass mark
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={passMark}
              onChange={(event) => {
                setCustomPassMark(event.target.value);
                clearError('passMark');
              }}
              {...fieldProps('passMark')}
            />
            {errors.passMark
              ? fieldError('passMark')
              : customPassMark === null && (
                  <p className="text-xs text-ink-muted">Half of “Out of” unless you change it.</p>
                )}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2.5">
          <button
            type="button"
            onClick={requestClose}
            disabled={isSaving}
            className={secondaryButtonClasses}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            aria-busy={isSaving}
            className={primaryButtonClasses}
          >
            {isSaving ? 'Adding…' : 'Add exam'}
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

export default AddExamDialog;
