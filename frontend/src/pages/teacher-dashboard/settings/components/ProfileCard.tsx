import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import type { Account, ProfileInput } from '../../../../api/settings/account';
import CheckCircleIcon from '../../../../components/icons/CheckCircleIcon';
import LockIcon from '../../../../components/icons/LockIcon';
import {
  formErrorClasses,
  inputClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from '../../../../components/formStyles';
import { getInitials } from '../../../../utils/initials';
import { formatPhone, isValidEgyptMobile, normalizePhone } from '../../../../utils/phone';
import SectionCard from '../../students/profile/components/SectionCard';

interface ProfileCardProps {
  account: Account;
  // Throws (ApiError) if the server refuses.
  onSave: (input: ProfileInput) => Promise<void>;
}

// Must match the backend, which uses the sign-up limits.
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 100;

const SAVED_MESSAGE_MS = 3000;

type FieldErrors = {
  name?: string;
  phone?: string;
};

// The server's rule too: trimmed, inner runs of spaces made one.
const tidyName = (text: string) => text.trim().replace(/\s+/g, ' ');

// "" -> null (no phone), anything else -> the 11-digit stored form.
const toStoredPhone = (text: string) => (text.trim() === '' ? null : normalizePhone(text));

const toShownPhone = (stored: string | null) => (stored ? formatPhone(stored) : '');

// Quick feedback only: the server checks again, and its check is the one
// that protects the data.
function validate(name: string, phone: string | null): FieldErrors {
  const errors: FieldErrors = {};

  if (!name) {
    errors.name = 'Enter your name.';
  } else if (name.length < NAME_MIN_LENGTH) {
    errors.name = `Your name needs at least ${NAME_MIN_LENGTH} characters.`;
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `Keep your name under ${NAME_MAX_LENGTH} characters.`;
  }

  if (phone !== null && !isValidEgyptMobile(phone)) {
    errors.phone = 'Enter an Egyptian mobile number, like 010 1234 5678.';
  }

  return errors;
}

function ProfileCard({ account, onSave }: ProfileCardProps) {
  const [name, setName] = useState(account.name);
  const [phone, setPhone] = useState(toShownPhone(account.phone));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const phoneId = useId();
  const emailId = useId();

  // Compared with what the server has, so "Save" means there's something to save.
  const isDirty = tidyName(name) !== account.name || toStoredPhone(phone) !== account.phone;

  useEffect(() => {
    if (!justSaved) return;

    const timer = setTimeout(() => setJustSaved(false), SAVED_MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [justSaved]);

  const discard = () => {
    setName(account.name);
    setPhone(toShownPhone(account.phone));
    setFieldErrors({});
    setFormError(null);
  };

  // Shows the number the way it will be stored, so the teacher can check it.
  const tidyPhone = () => {
    const stored = toStoredPhone(phone);
    if (stored && isValidEgyptMobile(stored)) setPhone(formatPhone(stored));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSaving || !isDirty) return;

    const trimmedName = tidyName(name);
    const storedPhone = toStoredPhone(phone);
    const errors = validate(trimmedName, storedPhone);

    setFieldErrors(errors);
    setFormError(null);

    if (errors.name) {
      nameRef.current?.focus();
      return;
    }

    if (errors.phone) {
      phoneRef.current?.focus();
      return;
    }

    setIsSaving(true);

    try {
      await onSave({ fullName: trimmedName, phone: storedPhone });

      setName(trimmedName);
      setPhone(toShownPhone(storedPhone));
      setJustSaved(true);
    } catch (error) {
      console.error(error);
      setFormError(
        error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SectionCard title="Profile">
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-tint text-lg font-extrabold text-primary sm:h-16 sm:w-16 sm:text-[22px]"
        >
          {getInitials(account.name)}
        </span>

        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-base font-bold text-ink">
            <span className="truncate">{account.name}</span>
            {account.isDemo && (
              <span className="rounded-full bg-warning-tint px-2 py-0.5 text-xs font-semibold text-warning">
                Demo
              </span>
            )}
          </p>
          <p className="truncate text-sm text-ink-muted">{account.email} · Teacher</p>
        </div>
      </div>

      <form
        noValidate
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 border-t border-border pt-5"
      >
        {formError && (
          <p
            role="alert"
            className={formErrorClasses}
          >
            {formError}
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={nameId}
              className="text-sm font-semibold text-ink"
            >
              Full name
            </label>
            <input
              ref={nameRef}
              id={nameId}
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (fieldErrors.name) setFieldErrors((errors) => ({ ...errors, name: undefined }));
              }}
              disabled={isSaving}
              maxLength={NAME_MAX_LENGTH + 10}
              autoComplete="name"
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
              htmlFor={phoneId}
              className="text-sm font-semibold text-ink"
            >
              Phone <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <input
              ref={phoneRef}
              id={phoneId}
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                if (fieldErrors.phone) {
                  setFieldErrors((errors) => ({ ...errors, phone: undefined }));
                }
              }}
              onBlur={tidyPhone}
              disabled={isSaving}
              placeholder="010 1234 5678"
              autoComplete="tel-national"
              aria-invalid={Boolean(fieldErrors.phone)}
              aria-describedby={fieldErrors.phone ? `${phoneId}-error` : undefined}
              className={inputClasses(Boolean(fieldErrors.phone))}
            />
            {fieldErrors.phone && (
              <p
                id={`${phoneId}-error`}
                className="text-[13px] text-danger"
              >
                {fieldErrors.phone}
              </p>
            )}
          </div>

          {/* readOnly, not disabled: it can still be focused, read and copied. */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor={emailId}
              className="text-sm font-semibold text-ink"
            >
              Email
            </label>
            <div className="relative">
              <input
                id={emailId}
                type="email"
                value={account.email}
                readOnly
                aria-describedby={`${emailId}-hint`}
                className="
                  h-[46px] w-full
                  rounded-[10px] border border-border bg-surface-hover
                  pl-3.5 pr-11
                  text-sm text-ink-secondary
                  outline-none
                  focus:border-primary focus:ring-[3px] focus:ring-primary-tint
                "
              />
              <LockIcon className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2" />
            </div>
            <p
              id={`${emailId}-hint`}
              className="text-[13px] text-ink-secondary"
            >
              The email you sign in with. It can’t be changed here.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-end">
          {/* Always in the page, so screen readers announce it when it fills. */}
          <p
            role="status"
            className={
              justSaved && !isDirty
                ? 'flex items-center justify-center gap-1.5 text-sm font-semibold text-success sm:mr-1'
                : 'sr-only'
            }
          >
            {justSaved && !isDirty && (
              <>
                <CheckCircleIcon className="h-[18px] w-[18px]" />
                Saved
              </>
            )}
          </p>

          {isDirty && (
            <button
              type="button"
              onClick={discard}
              disabled={isSaving}
              className={`${secondaryButtonClasses} w-full sm:w-auto`}
            >
              Discard
            </button>
          )}

          <button
            type="submit"
            disabled={!isDirty || isSaving}
            aria-busy={isSaving}
            className={`${primaryButtonClasses} w-full sm:w-auto`}
          >
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </SectionCard>
  );
}

export default ProfileCard;
