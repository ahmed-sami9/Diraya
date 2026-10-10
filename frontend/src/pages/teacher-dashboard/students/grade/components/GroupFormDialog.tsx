import { useId, useRef, useState, type FormEvent } from 'react';

import { ApiError } from '../../../../../api/apiClient';
import type { GroupInput, GroupSummary } from '../../../../../api/students/groups';
import DialogShell from '../../../../../components/DialogShell';
import {
  formErrorClasses,
  inputClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from '../../../../../components/formStyles';

interface GroupFormDialogProps {
  gradeName: string;
  // Pass a group to rename it; leave it out to add a new one.
  group?: GroupSummary;
  // Sends the form to the server. Throws (ApiError) if the server refuses.
  onSubmit: (input: GroupInput) => Promise<void>;
  onClose: () => void;
}

// Must match the limit the backend enforces.
const NAME_MAX_LENGTH = 60;

// "Add group" and, with a `group`, "Rename group".
//
// Only the name for now. The weekly schedule gets its own form in the next
// step: it is a list of days and times, too much to squeeze in here.
function GroupFormDialog({ gradeName, group, onSubmit, onClose }: GroupFormDialogProps) {
  const isEditing = Boolean(group);

  const [name, setName] = useState(group?.name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const nameId = useId();

  const requestClose = () => {
    if (!isSaving) onClose();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSaving) return;

    const trimmed = name.trim();

    if (!trimmed) {
      setNameError('Enter a name for the group.');
      inputRef.current?.focus();
      return;
    }

    if (trimmed.length > NAME_MAX_LENGTH) {
      setNameError(`Keep the name under ${NAME_MAX_LENGTH} characters.`);
      inputRef.current?.focus();
      return;
    }

    setIsSaving(true);
    setNameError(null);
    setFormError(null);

    try {
      await onSubmit({ name: trimmed });
      onClose();
    } catch (error) {
      console.error(error);

      if (error instanceof ApiError && error.code === 'GROUP_NAME_TAKEN') {
        setNameError(`${gradeName} already has a group with this name.`);
        inputRef.current?.focus();
      } else {
        setFormError(
          error instanceof Error ? error.message : 'Something went wrong. Please try again.'
        );
      }

      setIsSaving(false);
    }
  };

  return (
    <DialogShell
      title={isEditing ? 'Rename group' : 'Add group'}
      description={
        isEditing ? undefined : `A class inside ${gradeName}, like “Group A” or “Saturday group”.`
      }
      onRequestClose={requestClose}
      isBusy={isSaving}
      initialFocusRef={inputRef}
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
            htmlFor={nameId}
            className="text-sm font-semibold text-ink"
          >
            Group name
          </label>
          <input
            ref={inputRef}
            id={nameId}
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (nameError) setNameError(null);
            }}
            disabled={isSaving}
            placeholder="e.g. Group A"
            maxLength={NAME_MAX_LENGTH + 10}
            autoComplete="off"
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? `${nameId}-error` : undefined}
            className={inputClasses(Boolean(nameError))}
          />
          {nameError && (
            <p
              id={`${nameId}-error`}
              className="text-[13px] text-danger"
            >
              {nameError}
            </p>
          )}
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
            {isSaving ? 'Saving…' : isEditing ? 'Save' : 'Add group'}
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

export default GroupFormDialog;
