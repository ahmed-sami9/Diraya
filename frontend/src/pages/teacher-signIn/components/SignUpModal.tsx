import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
  type RefObject,
} from 'react';

import {
  MailIcon,
  LockIcon,
  XIcon,
  UserIcon,
  AlertCircleIcon,
} from '../../../components/icons/index.ts';
import PencilLoader from '../../../components/PencilLoader.tsx';
import useModalBehavior from '../../../hooks/useModalBehavior.ts';
import useTeacherSignUp from '../../../hooks/auth/useTeacherSignUp.ts';
import useDemoLogin from '../../../hooks/auth/useDemoLogin.ts';
import type { User } from '../../../context/AuthContext';
// Typed error so the UI can switch on a code instead of matching message strings.
import { AuthError } from '../../../api/auth/authErrors.ts';
import { googleLoginRequest } from '../../../api/auth/googleAuth.ts';
import { resendVerificationEmail } from '../../../api/auth/emailVerification.ts';
import { emailError, fullNameError, newPasswordError } from '../../../utils/authFormRules.ts';
import { waitForMinimumLoading } from '../../../utils/minimumDelay.ts';

import AuthTextField from './AuthTextField.tsx';
import SignInAlternatives from './SignInAlternatives.tsx';

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

// The server sends at most one confirmation email per minute per account.
const RESEND_COOLDOWN_SECONDS = 60;

const SERVER_ERROR_MESSAGE =
  "Your account wasn't created because something went wrong on our side. Try again in a moment.";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

// Returns an empty object when every field is valid.
const validateForm = (values: FormValues): FieldErrors => {
  const errors: FieldErrors = {};

  const fullNameProblem = fullNameError(values.fullName);
  if (fullNameProblem) errors.fullName = fullNameProblem;

  const emailProblem = emailError(values.email);
  if (emailProblem) errors.email = emailProblem;

  const passwordProblem = newPasswordError(values.password);
  if (passwordProblem) errors.password = passwordProblem;

  if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return errors;
};

/* -------------------------------------------------------------------------- */
/* SignUpFrame: the backdrop and the panel                                    */
/* -------------------------------------------------------------------------- */

interface SignUpFrameProps {
  // Escape, the backdrop or the × button. SignUpModal decides if it may close.
  onRequestClose: () => void;
  initialFocusRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}

// Its own component because useModalBehavior must mount and unmount with the
// open window, while SignUpModal stays mounted to keep what was typed.
function SignUpFrame({ onRequestClose, initialFocusRef, children }: SignUpFrameProps) {
  const panelRef = useModalBehavior<HTMLDivElement>({ onRequestClose, initialFocusRef });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="signup-title"
      onClick={onRequestClose}
      className="
        w-full h-full flex items-center justify-center fixed inset-0 z-50
        bg-black/30 backdrop-blur-sm
        px-4
      "
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="
          w-full max-w-[520px] max-h-[90vh] relative
          flex flex-col
          overflow-y-auto
          bg-surface
          rounded-lg
          shadow-xl
          px-8 py-8
        "
      >
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SignUpModal                                                                */
/* -------------------------------------------------------------------------- */

const SignUpModal = ({ isOpen, onClose, onSwitchToSignIn, onAuthSuccess }: SignUpModalProps) => {
  const { signUp } = useTeacherSignUp();
  const { tryDemo, isDemoLoading, demoError } = useDemoLogin(onAuthSuccess);

  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [formData, setFormData] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Storing the whole AuthError keeps its `code`, which decides which UI we show
  // (banner vs. inline under the email field).
  const [submitError, setSubmitError] = useState<AuthError | null>(null);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  // Set after a successful sign-up. While it holds an address, the window
  // shows "confirm your email" in place of the form.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  // Seconds until "Resend" can be used again. 0 means it is available.
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [resendError, setResendError] = useState<string | null>(null);

  // True while any request (sign up, Google or demo login) is in flight.
  const isBusy = isSubmitting || isGoogleSubmitting || isDemoLoading;

  // Which kind of server error we're showing. "Email taken" goes under the
  // email field; every other error goes in the banner above the form, and
  // only a failure on our side gets a "Try again" button.
  const emailTaken = submitError?.code === 'EMAIL_TAKEN';
  const serverFailed = submitError?.code === 'SERVER_ERROR';
  const bannerError = submitError && !emailTaken ? submitError : null;

  // Counts the resend cooldown down to zero, one second at a time.
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = window.setTimeout(() => setResendCooldown((seconds) => seconds - 1), 1000);

    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

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
      const { email } = await signUp(formData);

      await waitForMinimumLoading(startedAt);

      // The account exists but is not signed in yet. Switch to the "confirm
      // your email" view; signing in happens when they click the emailed link.
      setPendingEmail(email);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setResendStatus('idle');
      setResendError(null);
    } catch (error) {
      console.error(error);

      await waitForMinimumLoading(startedAt);

      // Keep the AuthError as-is. Anything unexpected (a bug in the hook,
      // a plain Error) is normalized to SERVER_ERROR so the UI only ever
      // deals with known codes.
      setSubmitError(
        error instanceof AuthError ? error : new AuthError('SERVER_ERROR', SERVER_ERROR_MESSAGE)
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // "Resend" on the confirm-your-email view.
  const handleResendVerification = async () => {
    if (!pendingEmail || resendCooldown > 0 || resendStatus === 'sending') return;

    setResendStatus('sending');
    setResendError(null);

    try {
      await resendVerificationEmail(pendingEmail);

      setResendStatus('sent');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      console.error(error);

      setResendStatus('idle');
      setResendError(
        error instanceof Error ? error.message : 'Could not send the email. Please try again.'
      );
    }
  };

  // Puts the window back to an empty sign-up form, so the next time it opens
  // it does not still show "confirm your email" for an old address.
  const resetAfterSignUp = () => {
    if (!pendingEmail) return;

    setPendingEmail(null);
    setFormData(EMPTY_FORM);
    setErrors({});
    setSubmitError(null);
    setResendCooldown(0);
    setResendStatus('idle');
    setResendError(null);
  };

  // Google. Our button hands us Google's one-time code. The backend exchanges
  // it for the person's identity, creates the account on first use, and
  // answers with our own user and session cookie. A first-time Google user is
  // signed up here; a returning one is simply signed in.
  const handleGoogleCode = async (code: string) => {
    if (isBusy) return;

    setSubmitError(null);
    setGoogleError(null);
    setErrors({});
    setIsGoogleSubmitting(true);

    const startedAt = Date.now();

    try {
      // Like normal sign-up, this starts a normal (not "remembered") session.
      const user = await googleLoginRequest({ code, rememberMe: false });

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

    resetAfterSignUp();
    onClose();
  };

  const handleSwitchToSignIn = () => {
    resetAfterSignUp();
    onSwitchToSignIn();
  };

  if (!isOpen) return null;

  /* ------------------------------- Render ------------------------------- */

  // The email field shows one message at a time: a validation error first,
  // otherwise "email already used" with a way forward.
  const emailFieldError: ReactNode =
    errors.email ??
    (emailTaken ? (
      <>
        {submitError.message}{' '}
        <button
          type="button"
          onClick={handleSwitchToSignIn}
          className="font-semibold text-primary hover:underline cursor-pointer"
        >
          Sign in instead
        </button>
      </>
    ) : undefined);

  return (
    <SignUpFrame
      onRequestClose={handleClose}
      initialFocusRef={closeButtonRef}
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
            text-ink-muted
            transition-colors
            hover:text-ink-secondary
            disabled:opacity-40
            disabled:cursor-not-allowed
          "
      >
        <XIcon />
      </button>

      {pendingEmail ? (
        /* ------------------- After sign-up: confirm your email ------------------- */
        <div className="flex flex-col items-center text-center">
          <span
            className="
                flex items-center justify-center
                w-14 h-14
                rounded-full
                bg-primary-tint
                text-primary
              "
          >
            <MailIcon className="w-7 h-7" />
          </span>

          <h2
            id="signup-title"
            className="mt-4 text-2xl font-bold text-ink"
          >
            Confirm your email
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
            We sent a link to{' '}
            <span className="font-semibold text-ink break-all">{pendingEmail}</span>. Click it to
            finish creating your account and go to your dashboard. The link expires in 24 hours.
          </p>

          <p
            className="mt-5 text-sm text-ink-secondary"
            aria-live="polite"
          >
            {resendStatus === 'sent'
              ? 'A new email is on its way. '
              : "Didn't get it? Check your spam folder, or "}
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendCooldown > 0 || resendStatus === 'sending'}
              className="
                  font-semibold
                  text-primary
                  cursor-pointer
                  rounded-sm

                  hover:underline

                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-primary
                  focus-visible:ring-offset-2 focus-visible:ring-offset-surface

                  disabled:text-ink-muted
                  disabled:cursor-not-allowed
                  disabled:no-underline
                "
            >
              {resendStatus === 'sending'
                ? 'Sending...'
                : resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : 'Resend the email'}
            </button>
          </p>

          {resendError && (
            <p
              role="alert"
              className="mt-2 text-xs font-medium text-danger"
            >
              {resendError}
            </p>
          )}

          <button
            type="button"
            onClick={handleSwitchToSignIn}
            className="
                w-full h-[50px]
                mt-6

                flex items-center justify-center

                text-sm
                font-semibold
                text-ink

                bg-surface
                border border-border-strong
                rounded-md

                cursor-pointer
                transition-colors

                hover:bg-surface-hover
                hover:border-ink-muted/50

                focus-visible:outline-none
                focus-visible:ring-2
                focus-visible:ring-primary
                focus-visible:ring-offset-2 focus-visible:ring-offset-surface

                xl:h-[46px]
              "
          >
            Back to sign in
          </button>
        </div>
      ) : (
        /* ------------------------------ Sign-up form ------------------------------ */
        <>
          {/* Heading */}
          <h2
            id="signup-title"
            className="text-2xl font-bold text-ink"
          >
            Create your account
          </h2>

          <p className="text-sm text-ink-muted mt-2">
            Join Diraya and start managing your classes with ease.
          </p>

          {/* Error banner. EMAIL_TAKEN is not shown here; it appears under the
                email field instead. */}
          {bannerError && (
            <div
              role="alert"
              className="
                  flex items-start gap-2.5
                  mt-5 px-4 py-3
                  bg-danger-tint border border-danger/30 rounded-lg
                  text-sm text-danger
                "
            >
              <AlertCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-danger" />

              <div className="flex-1">
                <span>{bannerError.message}</span>

                {/* Retrying only helps when the failure was on our side. */}
                {serverFailed && (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="block mt-1 font-semibold underline hover:no-underline cursor-pointer"
                  >
                    Try again
                  </button>
                )}
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
            <AuthTextField
              id="signup-full-name"
              label="Full name"
              icon={UserIcon}
              type="text"
              name="full-name"
              autoComplete="name"
              placeholder="Your full name"
              value={formData.fullName}
              error={errors.fullName}
              disabled={isSubmitting}
              onFocus={() => clearFieldError('fullName')}
              onChange={(e) => updateField('fullName', e.target.value)}
            />

            <AuthTextField
              id="signup-email"
              label="Email address"
              icon={MailIcon}
              type="email"
              name="email-address"
              autoComplete="email"
              placeholder="you@example.com"
              value={formData.email}
              error={emailFieldError}
              errorRole={!errors.email && emailTaken ? 'alert' : undefined}
              disabled={isSubmitting}
              onFocus={() => clearFieldError('email')}
              onChange={(e) => updateField('email', e.target.value)}
            />

            <AuthTextField
              id="signup-password"
              label="Password"
              icon={LockIcon}
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={formData.password}
              error={errors.password}
              disabled={isSubmitting}
              onFocus={() => clearFieldError('password')}
              onChange={(e) => updateField('password', e.target.value)}
            />

            <AuthTextField
              id="signup-confirm-password"
              label="Confirm password"
              icon={LockIcon}
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              placeholder="Type it again"
              value={formData.confirmPassword}
              error={errors.confirmPassword}
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
                  bg-primary-solid
                  text-white text-sm font-medium
                  rounded-md
                  px-6 py-2
                  mt-2
                  transition-colors
                  hover:bg-primary-hover
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
                'Sign up'
              )}
            </button>
          </form>

          {/* "or", Google, the link back to sign-in and the demo: shared with the sign-in form. */}
          <SignInAlternatives
            className="mt-5"
            disabled={isBusy}
            isDemoLoading={isDemoLoading}
            isGoogleSubmitting={isGoogleSubmitting}
            demoError={demoError}
            googleError={googleError}
            switchPrompt="Already have an account?"
            switchLabel="Sign in"
            onSwitch={handleSwitchToSignIn}
            onTryDemo={handleTryDemo}
            onGoogleCode={handleGoogleCode}
            onGoogleError={setGoogleError}
          />
        </>
      )}
    </SignUpFrame>
  );
};

export default SignUpModal;
