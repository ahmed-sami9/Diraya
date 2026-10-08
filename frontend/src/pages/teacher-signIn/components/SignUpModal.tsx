import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type FocusEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

import {
  EyeIcon,
  MailIcon,
  LockIcon,
  XIcon,
  UserIcon,
  AlertCircleIcon,
} from '../../../components/icons/index.ts';
import PencilLoader from '../../../components/PencilLoader.tsx';
import useTeacherSignUp from '../../../hooks/useTeacherSignUp.ts';
import useDemoLogin from '../../../hooks/useDemoLogin.ts';
import type { User } from '../../../context/AuthContext';
// Typed error so the UI can switch on a code instead of matching message strings.
import { AuthError } from '../../../api/authErrors.ts';
import { googleLoginRequest } from '../../../api/googleAuth.ts';

import GoogleSignInButton from './GoogleSignInButton.tsx';

/* -------------------------------------------------------------------------- */
/* Types and constants                                                        */
/* -------------------------------------------------------------------------- */

interface SignUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToSignIn: () => void;
  onAuthSuccess: (user: User) => void;
}

type FieldName = 'fullName' | 'email' | 'password' | 'confirmPassword';
type FormValues = Record<FieldName, string>;
type FieldErrors = Partial<Record<FieldName, string>>;

const EMPTY_FORM: FormValues = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
};

// Keeps the loader visible for at least this long so it never looks like a
// flicker/glitch on fast responses.
const MIN_LOADING_MS = 400;

const MIN_PASSWORD_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SERVER_ERROR_MESSAGE =
  "Your account wasn't created because something went wrong on our side. Try again in a moment.";

// Elements the Tab key can land on, used to keep focus inside the modal.
const FOCUSABLE_SELECTOR =
  'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

// Returns an empty object when every field is valid.
const validateForm = (values: FormValues): FieldErrors => {
  const errors: FieldErrors = {};

  if (!values.fullName.trim()) {
    errors.fullName = 'Full name is required';
  } else if (/\p{N}/u.test(values.fullName)) {
    errors.fullName = 'Full name cannot contain numbers';
  }

  if (!values.email.trim()) {
    errors.email = 'Email is required';
  } else if (!EMAIL_PATTERN.test(values.email)) {
    errors.email = 'Enter a valid email';
  }

  if (!values.password) {
    errors.password = 'Password is required';
  } else if (values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }

  if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return errors;
};

const waitForMinimumLoading = (startedAt: number) => {
  const remaining = MIN_LOADING_MS - (Date.now() - startedAt);

  return remaining > 0
    ? new Promise<void>((resolve) => setTimeout(resolve, remaining))
    : Promise.resolve();
};

/* -------------------------------------------------------------------------- */
/* SignUpField: one input with a leading icon and an error underneath         */
/* -------------------------------------------------------------------------- */

interface SignUpFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'placeholder' | 'aria-label'> {
  // Used as both the placeholder and the accessible name.
  label: string;
  // Pass the icon component itself (icon={MailIcon}), not an element.
  icon: ComponentType<{ className?: string }>;
  error?: ReactNode;
  errorId: string;
  // "alert" makes screen readers announce the error as soon as it appears.
  errorRole?: 'alert';
}

// With type="password" the field also renders its own show/hide toggle.
function SignUpField({
  label,
  icon: Icon,
  error,
  errorId,
  errorRole,
  type = 'text',
  disabled,
  ...inputProps
}: SignUpFieldProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  const isPassword = type === 'password';
  const hasError = !!error;

  return (
    <div className="w-full">
      <div className="relative">
        <Icon className="absolute top-1/2 left-4 -translate-y-1/2 text-gray-400" />

        <input
          {...inputProps}
          type={isPassword && isRevealed ? 'text' : type}
          disabled={disabled}
          aria-label={label}
          placeholder={label}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          className={`
            w-full h-[52px]
            pl-12 ${isPassword ? 'pr-12' : ''}
            border rounded-lg
            shadow-sm shadow-gray-200
            placeholder:text-gray-400
            focus:outline-none focus:ring-2
            disabled:bg-gray-50 disabled:cursor-not-allowed
            ${hasError ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'}
          `}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setIsRevealed((prev) => !prev)}
            disabled={disabled}
            aria-label={`${isRevealed ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
            aria-pressed={isRevealed}
            className="
              absolute top-1/2 right-4
              -translate-y-1/2
              text-gray-400
              cursor-pointer
              disabled:cursor-not-allowed
            "
          >
            <EyeIcon />
          </button>
        )}
      </div>

      {hasError && (
        <p
          id={errorId}
          role={errorRole}
          className="text-xs text-red-500 mt-1 pl-1"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SignUpModal                                                                */
/* -------------------------------------------------------------------------- */

const SignUpModal = ({ isOpen, onClose, onSwitchToSignIn, onAuthSuccess }: SignUpModalProps) => {
  const { signUp } = useTeacherSignUp();
  const { tryDemo, isDemoLoading, demoError } = useDemoLogin(onAuthSuccess);

  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  const [formData, setFormData] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Storing the whole AuthError keeps its `code`, which decides which UI we show
  // (banner vs. inline under the email field).
  const [submitError, setSubmitError] = useState<AuthError | null>(null);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  // True while any request (sign up, Google or demo login) is in flight.
  const isBusy = isSubmitting || isGoogleSubmitting || isDemoLoading;

  // Mirror isBusy in a ref so the modal effect below can read the latest
  // value without listing it as a dependency.
  const isBusyRef = useRef(isBusy);
  isBusyRef.current = isBusy;

  // Which kind of server error we're showing.
  const emailTaken = submitError?.code === 'EMAIL_TAKEN';
  const serverFailed = submitError?.code === 'SERVER_ERROR';

  /* ------------------------------ Handlers ------------------------------ */

  const updateField = (field: FieldName, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Removes one field's validation error when the user focuses that input.
  // `errors` is otherwise only rewritten on submit, so without this a message
  // would stay until the next submit.
  const clearFieldError = (field: FieldName) => {
    setErrors((prev) => {
      if (!prev[field]) return prev; // nothing to clear → same object, no re-render
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // Clears the server error as soon as the user focuses any input.
  // React's onFocus bubbles, so one handler on the <form> hears every input inside it.
  // The instanceof check stops buttons (eye toggles, submit) from clearing it.
  const handleFormFocus = (e: FocusEvent<HTMLFormElement>) => {
    if (submitError && e.target instanceof HTMLInputElement) {
      setSubmitError(null);
    }
  };

  const handleSubmit = async () => {
    if (isBusy) return;

    const nextErrors = validateForm(formData);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setSubmitError(null);
    setGoogleError(null);
    setIsSubmitting(true);

    const startedAt = Date.now();

    try {
      const user = await signUp(formData);

      // Success is handled by the parent (it stores the user and redirects).
      onAuthSuccess(user);
    } catch (error) {
      console.error(error);

      // Keep the AuthError as-is. Anything unexpected (a bug in the hook,
      // a plain Error) is normalized to SERVER_ERROR so the UI only ever sees
      // one of the two known codes.
      setSubmitError(
        error instanceof AuthError ? error : new AuthError('SERVER_ERROR', SERVER_ERROR_MESSAGE)
      );
    } finally {
      await waitForMinimumLoading(startedAt);
      setIsSubmitting(false);
    }
  };

  // Google. The button hands us Google's ID token (the "credential"). The
  // backend verifies it, creates the account on first use, and answers with
  // our own user and session cookie. A first-time Google user is signed up
  // here; a returning one is simply signed in.
  const handleGoogleCredential = async (credential: string) => {
    if (isBusy) return;

    setSubmitError(null);
    setGoogleError(null);
    setErrors({});
    setIsGoogleSubmitting(true);

    const startedAt = Date.now();

    try {
      // Like normal sign-up, this starts a normal (not "remembered") session.
      const user = await googleLoginRequest({ credential, rememberMe: false });

      await waitForMinimumLoading(startedAt);

      onAuthSuccess(user);
    } catch (error) {
      console.error(error);

      await waitForMinimumLoading(startedAt);

      // googleLoginRequest only throws messages written for users.
      setGoogleError(
        error instanceof Error ? error.message : 'Google sign-in failed. Please try again.'
      );
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  // The demo ignores the form fields, so it skips validation and only clears
  // the other errors before logging into the shared demo account.
  const handleTryDemo = () => {
    if (isBusy) return;

    setSubmitError(null);
    setGoogleError(null);
    tryDemo();
  };

  const handleClose = () => {
    // Don't let the modal be dismissed mid-request — the user would lose all
    // feedback on whether their account was actually created.
    if (isBusy) return;

    onClose();
  };

  /* ------------------- Focus, scroll lock and keyboard ------------------- */

  useEffect(() => {
    if (!isOpen) return;

    // Remember the element that opened the modal.
    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Lock background scrolling while the modal is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the modal.
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      // Close with Escape (but not while a request is in flight).
      if (event.key === 'Escape') {
        if (isBusyRef.current) return;
        onClose();
        return;
      }

      // Keep keyboard focus inside the modal.
      if (event.key !== 'Tab' || !modalRef.current) return;

      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      // Restore the previous body overflow value.
      document.body.style.overflow = previousOverflow;

      // Return focus to the element that opened the modal.
      if (previousActiveElementRef.current?.isConnected) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  /* ------------------------------- Render ------------------------------- */

  // The email field shows one message at a time: a validation error first,
  // otherwise "email already used" with a way forward.
  const emailError: ReactNode =
    errors.email ??
    (emailTaken ? (
      <>
        {submitError.message}{' '}
        <button
          type="button"
          onClick={onSwitchToSignIn}
          className="font-semibold text-[#3431E4] hover:underline cursor-pointer"
        >
          Sign in instead
        </button>
      </>
    ) : undefined);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="signup-title"
      onClick={handleClose}
      className="
        w-full h-full flex items-center justify-center fixed inset-0 z-50
        bg-black/30 backdrop-blur-sm
        px-4
      "
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="
          w-full max-w-[520px] max-h-[90vh] relative
          flex flex-col
          overflow-y-auto
          bg-white
          rounded-lg
          shadow-xl
          px-8 py-8
        "
      >
        {/* Close */}
        <button
          ref={closeButtonRef}
          type="button"
          onClick={handleClose}
          disabled={isBusy}
          aria-label="Close sign up form"
          className="
            absolute top-6 right-6
            text-gray-400
            transition-colors
            hover:text-gray-600
            disabled:opacity-40
            disabled:cursor-not-allowed
          "
        >
          <XIcon />
        </button>

        {/* Heading */}
        <h2
          id="signup-title"
          className="text-2xl font-bold text-slate-800"
        >
          Create your account
        </h2>

        <p className="text-sm text-[#878383] mt-2">
          Join Diraya and start managing your classes with ease.
        </p>

        {/* Server error banner with a retry button. Shown only for SERVER_ERROR;
            EMAIL_TAKEN appears under the email field instead. */}
        {serverFailed && (
          <div
            role="alert"
            className="
              flex items-start gap-2.5
              mt-5 px-4 py-3
              bg-red-50 border border-red-200 rounded-lg
              text-sm text-red-700
            "
          >
            <AlertCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />

            <div className="flex-1">
              <span>{submitError.message}</span>

              <button
                type="button"
                onClick={handleSubmit}
                className="block mt-1 font-semibold underline hover:no-underline cursor-pointer"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Form */}
        <form
          onFocus={handleFormFocus}
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          noValidate
          className="
            flex flex-col gap-4
            mt-6
          "
        >
          <SignUpField
            label="Full name"
            icon={UserIcon}
            type="text"
            name="full-name"
            value={formData.fullName}
            error={errors.fullName}
            errorId="fullName-error"
            disabled={isSubmitting}
            onFocus={() => clearFieldError('fullName')}
            onChange={(e) => updateField('fullName', e.target.value)}
          />

          <SignUpField
            label="Email address"
            icon={MailIcon}
            type="email"
            name="email-address"
            value={formData.email}
            error={emailError}
            errorId="email-error"
            errorRole={!errors.email && emailTaken ? 'alert' : undefined}
            disabled={isSubmitting}
            onFocus={() => clearFieldError('email')}
            onChange={(e) => updateField('email', e.target.value)}
          />

          <SignUpField
            label="Password"
            icon={LockIcon}
            type="password"
            name="password"
            value={formData.password}
            error={errors.password}
            errorId="password-error"
            disabled={isSubmitting}
            onFocus={() => clearFieldError('password')}
            onChange={(e) => updateField('password', e.target.value)}
          />

          <SignUpField
            label="Confirm password"
            icon={LockIcon}
            type="password"
            name="confirm-password"
            value={formData.confirmPassword}
            error={errors.confirmPassword}
            errorId="confirmPassword-error"
            disabled={isSubmitting}
            onFocus={() => clearFieldError('confirmPassword')}
            onChange={(e) => updateField('confirmPassword', e.target.value)}
          />

          <button
            type="submit"
            disabled={isBusy}
            aria-busy={isSubmitting}
            className="
              w-full h-[50px]
              flex items-center justify-center gap-2
              text-center
              bg-blue-600
              text-white text-sm font-medium
              rounded-md
              px-6 py-2
              mt-2
              transition-colors
              hover:bg-blue-700
              cursor-pointer
              disabled:cursor-not-allowed
              disabled:opacity-80
              xl:h-[45px]
            "
          >
            {isSubmitting ? (
              <>
                <PencilLoader />
                <span aria-live="polite">Signing up...</span>
              </>
            ) : (
              'Sign Up'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-2 my-5">
          <hr className="flex-1 border-gray-200" />
          <span className="text-sm text-gray-400">or</span>
          <hr className="flex-1 border-gray-200" />
        </div>

        {/* Google */}
        <GoogleSignInButton
          className="flex-shrink-0"
          disabled={isBusy}
          isSubmitting={isGoogleSubmitting}
          onCredential={handleGoogleCredential}
          onError={setGoogleError}
        />

        {googleError && (
          <p
            role="alert"
            className="text-xs font-medium text-red-600 text-center mt-3"
          >
            {googleError}
          </p>
        )}

        {/* Sign in */}
        <p className="text-sm font-medium text-[#7A7A7A] text-center mt-6">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignIn}
            disabled={isBusy}
            className="
              text-[#3431E4]
              hover:underline
              disabled:opacity-60
              disabled:cursor-not-allowed
              disabled:no-underline
            "
          >
            Sign in
          </button>
        </p>

        {/* Demo */}
        <p className="text-sm font-medium text-[#7A7A7A] text-center mt-4">
          Just looking around?{' '}
          <button
            type="button"
            onClick={handleTryDemo}
            disabled={isBusy}
            className="
              group
              inline-flex items-center gap-1

              text-[#3431E4]

              cursor-pointer

              hover:underline

              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-[#3431E4]
              focus-visible:ring-offset-2

              rounded-sm

              disabled:opacity-60
              disabled:cursor-not-allowed
              disabled:no-underline
            "
          >
            {isDemoLoading ? (
              'Loading demo…'
            ) : (
              <>
                Try the demo
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="
                    w-4 h-4
                    transition-transform duration-200
                    group-hover:translate-x-0.5
                  "
                >
                  <path d="M4 10h12M11 5l5 5-5 5" />
                </svg>
              </>
            )}
          </button>
        </p>

        {demoError && (
          <p
            role="alert"
            className="text-xs font-medium text-red-600 text-center mt-3"
          >
            {demoError}
          </p>
        )}
      </div>
    </div>
  );
};

export default SignUpModal;
