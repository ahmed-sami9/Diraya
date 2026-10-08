import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { LockIcon, AlertCircleIcon } from '../../components/icons/index.ts';
import PencilLoader from '../../components/PencilLoader.tsx';
import AuthPageShell from '../../components/AuthPageShell.tsx';
import { primaryButtonClasses, textLinkClasses } from '../../components/authPageClasses.ts';
import { useAuth } from '../../context/AuthContext';
import {
  verifyResetToken,
  resetPassword,
  InvalidResetLinkError,
} from '../../api/passwordReset.ts';

import AuthTextField from '../teacher-signIn/components/AuthTextField.tsx';

/* -------------------------------------------------------------------------- */
/* Types and constants                                                        */
/* -------------------------------------------------------------------------- */

// What the page is showing:
//   checking -> asking the server whether the link still works
//   ready    -> the new-password form
//   invalid  -> the link is wrong, used or expired
//   failed   -> the server could not be reached, so we cannot tell
type Status = 'checking' | 'ready' | 'invalid' | 'failed';

type FieldName = 'password' | 'confirmPassword';
type FieldErrors = Partial<Record<FieldName, string>>;

const SIGN_IN_PATH = '/teacher/sign-in';

// Same rule as sign-up and as the backend.
const MIN_PASSWORD_LENGTH = 8;

// Keeps the loading state on screen long enough to avoid a flicker.
const MIN_LOADING_MS = 400;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const validateFields = (password: string, confirmPassword: string): FieldErrors => {
  const errors: FieldErrors = {};

  if (!password) {
    errors.password = 'Password is required';
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }

  if (confirmPassword !== password) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return errors;
};

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

// Opened from the link in the reset email:
//   /teacher/reset-password?token=...
function TeacherResetPassword() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token') ?? '';

  // Without a token there is nothing to check.
  const [status, setStatus] = useState<Status>(token ? 'checking' : 'invalid');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ask the server about the link as soon as the page opens, so an expired
  // link is reported before the person types a new password.
  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();

    verifyResetToken(token, controller.signal)
      .then((isValid) => setStatus(isValid ? 'ready' : 'invalid'))
      .catch((error) => {
        if (controller.signal.aborted) return;

        console.error(error);
        setStatus('failed');
      });

    return () => controller.abort();
  }, [token]);

  /* ------------------------------ Handlers ------------------------------ */

  const clearFieldError = (field: FieldName) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    const errors = validateFields(password, confirmPassword);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    setSubmitError(null);
    setIsSubmitting(true);

    const startedAt = Date.now();
    const waitForMinimumLoading = () =>
      new Promise<void>((resolve) =>
        setTimeout(resolve, Math.max(MIN_LOADING_MS - (Date.now() - startedAt), 0))
      );

    try {
      await resetPassword(token, password);

      await waitForMinimumLoading();

      // The server ended every session for this account, so make sure the
      // app agrees that nobody is signed in on this browser.
      setUser(null);

      // Go to sign-in with a note for it to show a success message.
      navigate(SIGN_IN_PATH, {
        replace: true,
        state: { passwordWasReset: true },
      });
    } catch (error) {
      console.error(error);

      await waitForMinimumLoading();

      if (error instanceof InvalidResetLinkError) {
        // The link died between opening the page and submitting.
        setStatus('invalid');
      } else {
        setSubmitError(
          error instanceof Error ? error.message : 'Something went wrong. Please try again.'
        );
      }

      setIsSubmitting(false);
    }
  };

  /* ------------------------------- Render ------------------------------- */

  if (status === 'checking') {
    return (
      <AuthPageShell>
        <div
          role="status"
          className="flex flex-col items-center gap-4 py-10"
        >
          <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-[#3431E4] animate-spin" />
          <p className="text-sm font-medium text-gray-500">Checking your reset link...</p>
        </div>
      </AuthPageShell>
    );
  }

  if (status === 'invalid' || status === 'failed') {
    const isInvalid = status === 'invalid';

    return (
      <AuthPageShell>
        <span
          className="
            flex items-center justify-center
            w-12 h-12
            rounded-full
            bg-red-50
            text-red-500
          "
        >
          <AlertCircleIcon className="w-6 h-6" />
        </span>

        <h1 className="mt-4 text-2xl font-bold leading-tight text-slate-800">
          {isInvalid ? 'This link no longer works' : "We couldn't check your link"}
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          {isInvalid
            ? 'Reset links work once and expire after 30 minutes. Request a new one and use it straight away.'
            : 'The server could not be reached. Check your connection and try again.'}
        </p>

        {isInvalid ? (
          <Link
            to={SIGN_IN_PATH}
            state={{ openForgotPassword: true }}
            className={`${primaryButtonClasses} mt-6`}
          >
            Request a new link
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={`${primaryButtonClasses} mt-6`}
          >
            Try again
          </button>
        )}

        <p className="mt-5 text-center">
          <Link
            to={SIGN_IN_PATH}
            className={textLinkClasses}
          >
            Back to sign in
          </Link>
        </p>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell>
      <h1 className="text-2xl font-bold leading-tight text-slate-800 sm:text-3xl">
        Choose a new password
      </h1>

      <p className="mt-2 text-sm leading-relaxed text-gray-600">
        Use at least {MIN_PASSWORD_LENGTH} characters. You'll be signed out on all devices and can
        sign in again with the new password.
      </p>

      {submitError && (
        <div
          role="alert"
          className="
            flex items-start gap-2.5
            mt-5 px-4 py-3

            bg-red-50
            border border-red-200
            rounded-lg

            text-sm text-red-700
          "
        >
          <AlertCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />
          <span>{submitError}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col mt-6"
      >
        <AuthTextField
          id="new-password"
          label="New password"
          icon={LockIcon}
          type="password"
          name="new-password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          error={fieldErrors.password}
          disabled={isSubmitting}
          onFocus={() => clearFieldError('password')}
          onChange={(e) => {
            setPassword(e.target.value);
            clearFieldError('password');
            setSubmitError(null);
          }}
        />

        <AuthTextField
          className="mt-5"
          id="confirm-new-password"
          label="Confirm new password"
          icon={LockIcon}
          type="password"
          name="confirm-new-password"
          autoComplete="new-password"
          placeholder="Type it again"
          value={confirmPassword}
          error={fieldErrors.confirmPassword}
          disabled={isSubmitting}
          onFocus={() => clearFieldError('confirmPassword')}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            clearFieldError('confirmPassword');
            setSubmitError(null);
          }}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className={`${primaryButtonClasses} mt-6`}
        >
          {isSubmitting ? (
            <>
              <PencilLoader />
              <span aria-live="polite">Saving...</span>
            </>
          ) : (
            'Save new password'
          )}
        </button>
      </form>

      <p className="mt-5 text-center">
        <Link
          to={SIGN_IN_PATH}
          className={textLinkClasses}
        >
          Back to sign in
        </Link>
      </p>
    </AuthPageShell>
  );
}

export default TeacherResetPassword;
