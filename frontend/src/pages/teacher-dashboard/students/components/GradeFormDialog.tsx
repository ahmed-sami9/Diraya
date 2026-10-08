import { useId, useRef, useState, type FormEvent } from 'react';

import { ApiError } from '../../../../api/apiClient';
import type { GradeInput, GradeSummary } from '../../../../api/students/grades';
import XIcon from '../../../../components/icons/XIcon';
import useModalBehavior from '../../../../hooks/useModalBehavior';

interface GradeFormDialogProps {
  // Pass a grade to edit it; leave it out to create a new one.
  grade?: GradeSummary;
  // Sends the form to the server. Throws (ApiError) if the server refuses.
  onSubmit: (input: GradeInput) => Promise<void>;
  onClose: () => void;
}

// Must match the limits the backend enforces.
const NAME_MAX_LENGTH = 60;
const FEE_MAX = 100_000;

type FieldErrors = {
  name?: string;
  monthlyFee?: string;
};

// Checks the form before it is sent. The server checks again: this check is
// for quick feedback, the server's is the one that protects the data.
function validate(name: string, fee: string): FieldErrors {
  const errors: FieldErrors = {};

  if (!name) {
    errors.name = 'Enter a name for the grade.';
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `Keep the name under ${NAME_MAX_LENGTH} characters.`;
  }

  if (fee !== '') {
    const value = Number(fee);

    if (!Number.isInteger(value) || value < 0) {
      errors.monthlyFee = 'Enter a whole number of pounds, or leave it empty.';
    } else if (value > FEE_MAX) {
      errors.monthlyFee = `The fee can't be more than EGP ${FEE_MAX.toLocaleString('en-GB')}.`;
    }
  }

  return errors;
}

// The "Add grade" dialog. With a `grade` it becomes the "Edit grade" dialog.
//
// The parent mounts it only while it is open, so every opening starts with
// a fresh, empty form.
function GradeFormDialog({ grade, onSubmit, onClose }: GradeFormDialogProps) {
  const isEditing = Boolean(grade);

  const [name, setName] = useState(grade?.name ?? '');
  const [fee, setFee] = useState(grade?.monthlyFee != null ? String(grade.monthlyFee) : '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const nameId = useId();
  const feeId = useId();

  const requestClose = () => {
    // Don't close mid-request: the person would not learn whether it worked.
    if (!isSaving) onClose();
  };

  const panelRef = useModalBehavior<HTMLDivElement>({
    onRequestClose: requestClose,
    initialFocusRef: nameInputRef,
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSaving) return;

    const trimmedName = name.trim();
    const errors = validate(trimmedName, fee.trim());

    setFieldErrors(errors);
    setFormError(null);

    if (errors.name) {
      nameInputRef.current?.focus();
      return;
    }

    if (errors.monthlyFee) return;

    setIsSaving(true);

    try {
      await onSubmit({
        name: trimmedName,
        monthlyFee: fee.trim() === '' ? null : Number(fee),
      });

      onClose();
    } catch (error) {
      console.error(error);

      // Put the server's answer next to the field it is about.
      if (error instanceof ApiError && error.code === 'GRADE_NAME_TAKEN') {
        setFieldErrors({ name: 'You already have a grade with this name.' });
        nameInputRef.current?.focus();
      } else {
        setFormError(
          error instanceof Error ? error.message : 'Something went wrong. Please try again.'
        );
      }

      setIsSaving(false);
    }
  };

  const inputClasses = (hasError: boolean) => `
    h-[46px] w-full
    rounded-[10px] border bg-surface
    px-3.5
    text-sm text-ink
    outline-none
    transition-colors
    placeholder:text-ink-muted
    focus:ring-[3px]
    disabled:cursor-not-allowed disabled:bg-surface-hover
    ${
      hasError
        ? 'border-danger focus:ring-danger-tint'
        : 'border-border hover:border-ink-muted/40 focus:border-primary focus:ring-primary-tint'
    }
  `;

  return (
    <div
      onClick={requestClose}
      className="
        fixed inset-0 z-50
        flex items-center justify-center
        bg-ink/40 px-4
        transition-opacity duration-200
        starting:opacity-0
        motion-reduce:transition-none
      "
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className="
          w-full max-w-[480px]
          rounded-2xl bg-surface
          shadow-2xl shadow-ink/20
          transition-[opacity,scale] duration-200
          starting:scale-95 starting:opacity-0
          motion-reduce:transition-none
        "
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-6">
          <div>
            <h2
              id={titleId}
              className="text-[19px] font-bold text-ink"
            >
              {isEditing ? 'Edit grade' : 'Add grade'}
            </h2>
            {!isEditing && (
              <p className="mt-1 text-sm text-ink-secondary">
                You can add groups and students once the grade exists.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={requestClose}
            disabled={isSaving}
            aria-label="Close"
            className="
              -mr-3 -mt-2
              flex h-11 w-11 shrink-0 items-center justify-center
              rounded-[10px] text-ink-secondary
              cursor-pointer
              hover:bg-surface-hover hover:text-ink
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
              disabled:cursor-not-allowed disabled:opacity-40
            "
          >
            <XIcon />
          </button>
        </div>

        <form
          noValidate
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 px-6 pb-6 pt-5"
        >
          {formError && (
            <p
              role="alert"
              className="rounded-lg border border-danger/20 bg-danger-tint px-4 py-3 text-sm text-danger"
            >
              {formError}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={nameId}
              className="text-sm font-semibold text-ink"
            >
              Grade name
            </label>
            <input
              ref={nameInputRef}
              id={nameId}
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (fieldErrors.name) setFieldErrors((errors) => ({ ...errors, name: undefined }));
              }}
              disabled={isSaving}
              placeholder="e.g. Grade 3 Secondary"
              maxLength={NAME_MAX_LENGTH + 10}
              autoComplete="off"
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? `${nameId}-error` : undefined}
              className={inputClasses(Boolean(fieldErrors.name))}
            />
            {fieldErrors.name && (
              <p
                id={`${nameId}-error`}
                className="text-[13px] text-danger"
              >
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={feeId}
              className="text-sm font-semibold text-ink"
            >
              Monthly fee <span className="font-normal text-ink-muted">(optional)</span>
            </label>

            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-secondary"
              >
                EGP
              </span>
              <input
                id={feeId}
                type="text"
                inputMode="numeric"
                value={fee}
                onChange={(event) => {
                  // Digits only: no letters, signs or decimal points.
                  setFee(event.target.value.replace(/\D/g, ''));
                  if (fieldErrors.monthlyFee) {
                    setFieldErrors((errors) => ({ ...errors, monthlyFee: undefined }));
                  }
                }}
                disabled={isSaving}
                placeholder="400"
                autoComplete="off"
                aria-invalid={Boolean(fieldErrors.monthlyFee)}
                aria-describedby={`${feeId}-hint`}
                className={`${inputClasses(Boolean(fieldErrors.monthlyFee))} pl-14`}
              />
            </div>

            <p
              id={`${feeId}-hint`}
              className={`text-[13px] ${fieldErrors.monthlyFee ? 'text-danger' : 'text-ink-secondary'}`}
            >
              {fieldErrors.monthlyFee ?? 'Leave it empty to use your default fee from Settings.'}
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={requestClose}
              disabled={isSaving}
              className="
                h-11 rounded-[10px] border border-border bg-surface px-[18px]
                text-sm font-semibold text-ink
                cursor-pointer
                hover:bg-surface-hover
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
                disabled:cursor-not-allowed disabled:opacity-60
              "
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              aria-busy={isSaving}
              className="
                h-11 rounded-[10px] bg-primary px-[18px]
                text-sm font-semibold text-white
                cursor-pointer
                transition-colors
                hover:bg-primary-hover
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
                disabled:cursor-not-allowed disabled:opacity-70
              "
            >
              {isSaving ? 'Saving…' : isEditing ? 'Save' : 'Create grade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default GradeFormDialog;
