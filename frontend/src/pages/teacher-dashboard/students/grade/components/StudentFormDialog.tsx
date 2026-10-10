import { useId, useRef, useState, type FormEvent } from 'react';

import { ApiError } from '../../../../../api/apiClient';
import type { GroupSummary } from '../../../../../api/students/groups';
import type { StudentInput } from '../../../../../api/students/students';
import DialogShell from '../../../../../components/DialogShell';
import {
  formErrorClasses,
  inputClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from '../../../../../components/formStyles';
import { isValidEgyptMobile, normalizePhone } from '../../../../../utils/phone';

interface StudentFormDialogProps {
  gradeName: string;
  groups: GroupSummary[];
  // The group picked in the filter, so adding from "Group A" puts them there.
  // null ("All students"): the grade's first group is preselected.
  defaultGroupId: string | null;
  // Sends the form to the server. Throws (ApiError) if the server refuses.
  onSubmit: (input: StudentInput) => Promise<void>;
  onClose: () => void;
}

// Must match the limits the backend enforces.
const NAME_MAX_LENGTH = 100;
const NOTES_MAX_LENGTH = 500;

type Field = 'fullName' | 'parentPhone' | 'phone' | 'groupId' | 'notes';
type FieldErrors = Partial<Record<Field, string>>;

const PHONE_HINT = 'An Egyptian mobile number, like 010 1234 5678.';

// "Add student". Only what's needed to start: the student's name, a
// parent's number (the person a teacher calls about absences and payments)
// and their group (the class whose attendance sheet they appear on).
// Everything else can be filled in later from the student's profile.
//
// The student's code (26-0042) isn't typed here: the server gives it.
function StudentFormDialog({
  gradeName,
  groups,
  defaultGroupId,
  onSubmit,
  onClose,
}: StudentFormDialogProps) {
  const [fullName, setFullName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [phone, setPhone] = useState('');
  // Always starts on a real group: every grade has at least one.
  const [groupId, setGroupId] = useState(defaultGroupId ?? groups[0]?.id ?? '');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const parentPhoneRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const ids = {
    fullName: useId(),
    parentPhone: useId(),
    phone: useId(),
    groupId: useId(),
    notes: useId(),
  };

  const requestClose = () => {
    if (!isSaving) onClose();
  };

  const clearError = (field: Field) => {
    if (errors[field]) setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSaving) return;

    const name = fullName.trim().replace(/\s+/g, ' ');
    const parent = normalizePhone(parentPhone);
    const own = normalizePhone(phone);
    const note = notes.trim();

    const found: FieldErrors = {};

    if (!name) found.fullName = 'Enter the student’s name.';
    else if (name.length > NAME_MAX_LENGTH)
      found.fullName = `Keep the name under ${NAME_MAX_LENGTH} characters.`;

    if (!parent) found.parentPhone = 'Enter a parent’s mobile number.';
    else if (!isValidEgyptMobile(parent)) found.parentPhone = PHONE_HINT;

    if (own && !isValidEgyptMobile(own)) found.phone = PHONE_HINT;

    if (!groupId) found.groupId = 'Pick the student’s group.';

    if (note.length > NOTES_MAX_LENGTH)
      found.notes = `Keep notes under ${NOTES_MAX_LENGTH} characters.`;

    setErrors(found);
    setFormError(null);

    // Focus the first field with a problem, in the order they appear.
    if (found.fullName) return nameRef.current?.focus();
    if (found.parentPhone) return parentPhoneRef.current?.focus();
    if (found.phone) return phoneRef.current?.focus();
    if (found.groupId || found.notes) return;

    setIsSaving(true);

    try {
      await onSubmit({
        fullName: name,
        parentPhone: parent,
        phone: own || null,
        groupId,
        notes: note || null,
      });

      onClose();
    } catch (error) {
      console.error(error);

      if (error instanceof ApiError && error.code === 'GROUP_NOT_FOUND') {
        setErrors({ groupId: 'This group no longer exists. Pick another one.' });
      } else {
        setFormError(
          error instanceof Error ? error.message : 'Something went wrong. Please try again.'
        );
      }

      setIsSaving(false);
    }
  };

  const labelClasses = 'text-sm font-semibold text-ink';
  const optional = <span className="font-normal text-ink-muted">(optional)</span>;

  return (
    <DialogShell
      title="Add student"
      description={`To ${gradeName}. You can add the rest of their details later, from their profile.`}
      onRequestClose={requestClose}
      isBusy={isSaving}
      initialFocusRef={nameRef}
      maxWidthClassName="max-w-[520px]"
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
            htmlFor={ids.fullName}
            className={labelClasses}
          >
            Full name
          </label>
          <input
            ref={nameRef}
            id={ids.fullName}
            type="text"
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value);
              clearError('fullName');
            }}
            disabled={isSaving}
            placeholder="e.g. Omar Adel Mahmoud"
            autoComplete="off"
            maxLength={NAME_MAX_LENGTH + 10}
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? `${ids.fullName}-error` : undefined}
            className={inputClasses(Boolean(errors.fullName))}
          />
          {errors.fullName && (
            <p
              id={`${ids.fullName}-error`}
              className="text-[13px] text-danger"
            >
              {errors.fullName}
            </p>
          )}
        </div>

        {/* Two phones side by side from tablet width, stacked on phones. */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={ids.parentPhone}
              className={labelClasses}
            >
              Parent’s mobile
            </label>
            <input
              ref={parentPhoneRef}
              id={ids.parentPhone}
              type="tel"
              inputMode="tel"
              value={parentPhone}
              onChange={(event) => {
                setParentPhone(event.target.value);
                clearError('parentPhone');
              }}
              disabled={isSaving}
              placeholder="010 1234 5678"
              autoComplete="off"
              aria-invalid={Boolean(errors.parentPhone)}
              aria-describedby={errors.parentPhone ? `${ids.parentPhone}-error` : undefined}
              className={inputClasses(Boolean(errors.parentPhone))}
            />
            {errors.parentPhone && (
              <p
                id={`${ids.parentPhone}-error`}
                className="text-[13px] text-danger"
              >
                {errors.parentPhone}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={ids.phone}
              className={labelClasses}
            >
              Student’s mobile {optional}
            </label>
            <input
              ref={phoneRef}
              id={ids.phone}
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                clearError('phone');
              }}
              disabled={isSaving}
              placeholder="011 1234 5678"
              autoComplete="off"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? `${ids.phone}-error` : undefined}
              className={inputClasses(Boolean(errors.phone))}
            />
            {errors.phone && (
              <p
                id={`${ids.phone}-error`}
                className="text-[13px] text-danger"
              >
                {errors.phone}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={ids.groupId}
            className={labelClasses}
          >
            Group
          </label>
          {/* A native <select>: works with keyboard, screen readers and the
              phone's own picker for free. */}
          <select
            id={ids.groupId}
            value={groupId}
            onChange={(event) => {
              setGroupId(event.target.value);
              clearError('groupId');
            }}
            disabled={isSaving}
            aria-invalid={Boolean(errors.groupId)}
            aria-describedby={`${ids.groupId}-hint`}
            className={`${inputClasses(Boolean(errors.groupId))} cursor-pointer`}
          >
            {groups.map((group) => (
              <option
                key={group.id}
                value={group.id}
              >
                {group.name}
              </option>
            ))}
          </select>
          <p
            id={`${ids.groupId}-hint`}
            className={`text-[13px] ${errors.groupId ? 'text-danger' : 'text-ink-secondary'}`}
          >
            {errors.groupId ?? 'Their attendance is taken with this group.'}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={ids.notes}
            className={labelClasses}
          >
            Notes {optional}
          </label>
          <textarea
            id={ids.notes}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              clearError('notes');
            }}
            disabled={isSaving}
            rows={3}
            placeholder="Only you can see these. e.g. sibling of Salma, pays in cash"
            aria-invalid={Boolean(errors.notes)}
            aria-describedby={`${ids.notes}-count`}
            className={`${inputClasses(Boolean(errors.notes))} h-auto resize-y py-3`}
          />
          <p
            id={`${ids.notes}-count`}
            className={`text-right text-[13px] ${errors.notes ? 'text-danger' : 'text-ink-muted'}`}
          >
            {errors.notes ?? `${notes.trim().length}/${NOTES_MAX_LENGTH}`}
          </p>
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
            {isSaving ? 'Adding…' : 'Add student'}
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

export default StudentFormDialog;
