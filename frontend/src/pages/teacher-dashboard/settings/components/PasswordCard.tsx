import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { ApiError } from '../../../../api/apiClient';
import type { Account, PasswordChangeInput } from '../../../../api/settings/account';
import CheckCircleIcon from '../../../../components/icons/CheckCircleIcon';
import InfoIcon from '../../../../components/icons/InfoIcon';
import { formErrorClasses, primaryButtonClasses } from '../../../../components/formStyles';
import SectionCard from '../../students/profile/components/SectionCard';

import PasswordField from './PasswordField';

interface PasswordCardProps {
  account: Account;
  // Throws (ApiError) if the server refuses.
  onChangePassword: (input: PasswordChangeInput) => Promise<void>;
}

// Must match the backend (the sign-up and reset rules).
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

type Fields = { current: string; next: string; confirm: string };
type FieldErrors = Partial<Record<keyof Fields, string>>;

const EMPTY: Fields = { current: '', next: '', confirm: '' };

function validate({ current, next, confirm }: Fields): FieldErrors {
  const errors: FieldErrors = {};

  if (!current) errors.current = 'Enter your current password.';

  if (!next) {
    errors.next = 'Enter a new password.';
  } else if (next.length < PASSWORD_MIN_LENGTH) {
    errors.next = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  } else if (next.length > PASSWORD_MAX_LENGTH) {
    errors.next = `Keep it under ${PASSWORD_MAX_LENGTH} characters.`;
  } else if (next === current) {
    errors.next = 'Choose a password different from your current one.';
  }

  if (!confirm) {
    errors.confirm = 'Enter the new password again.';
  } else if (next && confirm !== next) {
    errors.confirm = 'The passwords don’t match.';
  }

  return errors;
}

// Three versions: the form, or a note when there's no password to change.
function PasswordCard({ account, onChangePassword }: PasswordCardProps) {
  if (account.isDemo) {
    return (
      <SectionCard title="Password">
        <Notice
          tone="warning"
          title="Demo accounts don’t have a password"
          text="This account and everything in it are deleted when you sign out, or after 24 hours."
          icon={<InfoIcon className="h-5 w-5" />}
        />
      </SectionCard>
    );
  }

  if (!account.hasPassword) {
    return (
      <SectionCard title="Password">
        <Notice
          tone="neutral"
          title="You sign in with Google"
          text="Your account has no password, so there’s nothing to change here."
          icon={
            <img
              src="/google-logo.png"
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 object-contain"
            />
          }
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Password">
      <PasswordForm
        email={account.email}
        onChangePassword={onChangePassword}
      />
    </SectionCard>
  );
}

function PasswordForm({
  email,
  onChangePassword,
}: { email: string } & Omit<PasswordCardProps, 'account'>) {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  const currentRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  // A disabled input can't take focus, so a field to focus after the server
  // answers waits here until the form is unlocked.
  const focusAfterSave = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isSaving || !focusAfterSave.current) return;
    focusAfterSave.current.focus();
    focusAfterSave.current = null;
  }, [isSaving]);

  const update = (key: keyof Fields) => (value: string) => {
    setFields((previous) => ({ ...previous, [key]: value }));
    setFieldErrors((errors) => ({ ...errors, [key]: undefined }));
    setSucceeded(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSaving) return;

    const errors = validate(fields);

    setFieldErrors(errors);
    setFormError(null);
    setSucceeded(false);

    // Focus the first field that needs attention, in the order they appear.
    const firstInvalid = (['current', 'next', 'confirm'] as const).find((key) => errors[key]);
    if (firstInvalid) {
      ({ current: currentRef, next: nextRef, confirm: confirmRef })[firstInvalid].current?.focus();
      return;
    }

    setIsSaving(true);

    try {
      await onChangePassword({ currentPassword: fields.current, newPassword: fields.next });

      setFields(EMPTY);
      setSucceeded(true);
    } catch (error) {
      console.error(error);

      if (error instanceof ApiError && error.code === 'INVALID_CURRENT_PASSWORD') {
        setFieldErrors({ current: 'That’s not your current password.' });
        focusAfterSave.current = currentRef.current;
      } else {
        setFormError(
          error instanceof Error ? error.message : 'Something went wrong. Please try again.'
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
    >
      {/* Tells password managers which account this password belongs to. */}
      <input
        type="email"
        name="username"
        autoComplete="username"
        value={email}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />

      {formError && (
        <p
          role="alert"
          className={formErrorClasses}
        >
          {formError}
        </p>
      )}

      <div className="flex max-w-[420px] flex-col gap-5">
        <PasswordField
          label="Current password"
          value={fields.current}
          onChange={update('current')}
          autoComplete="current-password"
          error={fieldErrors.current}
          disabled={isSaving}
          inputRef={currentRef}
        />
        <PasswordField
          label="New password"
          value={fields.next}
          onChange={update('next')}
          autoComplete="new-password"
          error={fieldErrors.next}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          disabled={isSaving}
          inputRef={nextRef}
        />
        <PasswordField
          label="Confirm new password"
          value={fields.confirm}
          onChange={update('confirm')}
          autoComplete="new-password"
          error={fieldErrors.confirm}
          disabled={isSaving}
          inputRef={confirmRef}
        />
      </div>

      <p
        role="status"
        className={
          succeeded
            ? 'flex items-center gap-2 rounded-[10px] bg-success-tint px-4 py-3 text-sm font-semibold text-success'
            : 'sr-only'
        }
      >
        {succeeded && (
          <>
            <CheckCircleIcon className="h-[18px] w-[18px] shrink-0" />
            Password updated. You’ve been signed out on your other devices.
          </>
        )}
      </p>

      {/* The consequence comes before the button, so it's read before the click. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex flex-1 items-center gap-2.5 rounded-[10px] bg-primary-tint px-4 py-3 text-sm text-ink">
          <InfoIcon className="h-[18px] w-[18px] shrink-0 text-primary" />
          Changing it signs you out on every other device.
        </p>

        <button
          type="submit"
          disabled={isSaving}
          aria-busy={isSaving}
          className={`${primaryButtonClasses} w-full shrink-0 sm:w-auto`}
        >
          {isSaving ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </form>
  );
}

function Notice({
  tone,
  title,
  text,
  icon,
}: {
  tone: 'neutral' | 'warning';
  title: string;
  text: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <span
        aria-hidden="true"
        className={`
          flex h-11 w-11 shrink-0 items-center justify-center rounded-full
          ${tone === 'warning' ? 'bg-warning-tint text-warning' : 'border border-border bg-surface'}
        `}
      >
        {icon}
      </span>
      <div className="flex flex-col gap-0.5 pt-0.5">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-sm text-ink-secondary">{text}</p>
      </div>
    </div>
  );
}

export default PasswordCard;
