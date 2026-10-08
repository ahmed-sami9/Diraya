import { useEffect, useRef, useState, type FocusEvent, type FormEvent } from 'react';

import { MailIcon, LockIcon, AlertCircleIcon } from '../../../components/icons/index';
import CheckCircleIcon from '../../../components/icons/CheckCircleIcon.tsx';
import PencilLoader from '../../../components/PencilLoader.tsx';
import useTeacherLogin from '../../../hooks/auth/useTeacherLogin.ts';
import useDemoLogin from '../../../hooks/auth/useDemoLogin.ts';
import type { User } from '../../../context/AuthContext';
import { AuthError } from '../../../api/auth/authErrors';
import { googleLoginRequest } from '../../../api/auth/googleAuth';
import { resendVerificationEmail } from '../../../api/auth/emailVerification.ts';

import AuthTextField from './AuthTextField.tsx';
import SignInAlternatives from './SignInAlternatives.tsx';

/* -------------------------------------------------------------------------- */
/* Types and constants                                                        */
/* -------------------------------------------------------------------------- */

interface SignInLeftSectionProps {
  onSignUp: () => void;
  // Opens the forgot-password window, carrying over the email typed so far.
  onForgotPassword: (email: string) => void;
  isOpen: boolean;
  onAuthSuccess: (user: User) => void;
  // A success message shown above the form, e.g. after a password reset.
  notice?: string | null;
}

type FieldName = 'email' | 'password';
type FieldErrors = Partial<Record<FieldName, string>>;

// Same key TeacherSignIn uses to decide which section opens first.
const HAS_VISITED_KEY = 'diraya_hasVisited';

const MIN_LOADING_MS = 400;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

// Keeps the loading state on screen long enough to avoid a flicker.
const waitForMinimumLoading = (startedAt: number) => {
  const remaining = MIN_LOADING_MS - (Date.now() - startedAt);

  return remaining > 0
    ? new Promise<void>((resolve) => setTimeout(resolve, remaining))
    : Promise.resolve();
};

// Returns an empty object when both fields are valid.
const validateFields = (email: string, password: string): FieldErrors => {
  const errors: FieldErrors = {};

  if (!email.trim()) {
    errors.email = 'Email is required';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email';
  }

  if (!password) {
    errors.password = 'Password is required';
  }

  return errors;
};

// Reads whether this browser has seen the page before (decides the welcome
// message), then records the visit for next time.
const useHasVisited = () => {
  const [hasVisited] = useState(() => {
    try {
      return localStorage.getItem(HAS_VISITED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(HAS_VISITED_KEY, 'true');
    } catch {
      // Keep the page working when browser storage is unavailable.
    }
  }, []);

  return hasVisited;
};

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

function SignInLeftSection({
  onSignUp,
  onForgotPassword,
  isOpen,
  onAuthSuccess,
  notice,
}: SignInLeftSectionProps) {
  const { login } = useTeacherLogin();
  const { tryDemo, isDemoLoading, demoError, clearDemoError } = useDemoLogin(onAuthSuccess);
  const hasVisited = useHasVisited();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loginError, setLoginError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  // Set when sign-in fails because the email was never confirmed. It holds
  // the address, so the error can offer to send the confirmation email again.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  // True while any request (password, Google or demo sign-in) is running.
  const isBusy = isSubmitting || isGoogleSubmitting || isDemoLoading;

  // Safety net on top of isBusy. State only updates on the next render, but a
  // ref changes immediately, so a second action that starts before that render
  // (for example a Google popup finishing mid-request) is still blocked.
  const actionInFlight = useRef(false);

  /* ------------------------------ Handlers ------------------------------ */

  const clearFieldError = (field: FieldName) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // Typing in a field updates its value and clears any error about it.
  const handleFieldChange = (field: FieldName, value: string) => {
    if (field === 'email') setEmail(value);
    else setPassword(value);

    clearFieldError(field);
    setLoginError(null);
  };

  // Focusing an input clears the sign-in error. Focus on buttons is ignored.
  const handleFormFocus = (e: FocusEvent<HTMLFormElement>) => {
    if (e.target instanceof HTMLInputElement) {
      setLoginError(null);
    }
  };

  // Clears every message before a new sign-in attempt starts.
  const resetMessages = () => {
    setLoginError(null);
    setUnverifiedEmail(null);
    setResendStatus('idle');
    clearDemoError();
  };

  // 1. Email and password
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (isBusy || actionInFlight.current) return;

    const errors = validateFields(email, password);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    actionInFlight.current = true;
    resetMessages();
    setSubmitting(true);

    const startedAt = Date.now();

    try {
      const user = await login({ email, password, rememberMe });

      await waitForMinimumLoading(startedAt);

      onAuthSuccess(user);
    } catch (error) {
      console.error(error);

      // Wait before showing the error so it never appears while the button
      // still says "Signing in...".
      await waitForMinimumLoading(startedAt);

      setLoginError(
        error instanceof AuthError ? error.message : 'Something went wrong. Please try again.'
      );

      // Right password, unconfirmed email: remember the address so the error
      // box can show a "send it again" button.
      if (error instanceof AuthError && error.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(email.trim());
      }
    } finally {
      actionInFlight.current = false;
      setSubmitting(false);
    }
  };

  // Sends the confirmation email again for the address that just failed.
  const handleResendVerification = async () => {
    if (!unverifiedEmail || resendStatus !== 'idle') return;

    setResendStatus('sending');

    try {
      await resendVerificationEmail(unverifiedEmail);

      setResendStatus('sent');
    } catch (error) {
      console.error(error);

      setUnverifiedEmail(null);
      setResendStatus('idle');
      setLoginError(
        error instanceof Error ? error.message : 'Could not send the email. Please try again.'
      );
    }
  };

  // 2. Google. Our button hands us Google's one-time code. The frontend can
  // do nothing with it, so it goes to the backend, which exchanges it with
  // Google for the person's identity and answers with our own user and
  // session cookie.
  const handleGoogleCode = async (code: string) => {
    if (isBusy || actionInFlight.current) return;

    actionInFlight.current = true;
    resetMessages();
    setFieldErrors({});
    setIsGoogleSubmitting(true);

    const startedAt = Date.now();

    try {
      const user = await googleLoginRequest({ code, rememberMe });

      await waitForMinimumLoading(startedAt);

      onAuthSuccess(user);
    } catch (error) {
      console.error(error);

      await waitForMinimumLoading(startedAt);

      // googleLoginRequest only throws messages written for users, so any
      // Error's message is safe to show.
      setLoginError(
        error instanceof Error ? error.message : 'Google sign-in failed. Please try again.'
      );
    } finally {
      actionInFlight.current = false;
      setIsGoogleSubmitting(false);
    }
  };

  // Google's own window failed or was closed before finishing.
  const handleGoogleError = (message: string) => {
    if (actionInFlight.current) return;

    clearDemoError();
    setLoginError(message);
  };

  // 3. Demo. It ignores the form fields, so it skips validation and logs
  // into the shared demo account. The hook shows its own error message.
  const handleTryDemo = async () => {
    if (isBusy || actionInFlight.current) return;

    actionInFlight.current = true;
    resetMessages();

    try {
      await tryDemo();
    } finally {
      actionInFlight.current = false;
    }
  };

  /* ------------------------------- Render ------------------------------- */

  return (
    <section
      aria-label="Sign in"
      className={`
        w-full max-w-[500px]
        flex-col items-center
        mx-auto
        px-5 pt-3 pb-8
        mt-4
        sm:px-6
        md:max-w-[600px]

        lg:w-[40%]
        lg:max-w-none
        lg:min-h-[calc(100vh-40px)]
        lg:h-auto
        lg:my-5
        lg:px-6
        lg:pt-20
        lg:pb-8
        lg:bg-white
        lg:rounded-3xl
        lg:shadow-lg
        lg:ml-4
        lg:justify-start

        xl:w-[36%]
        xl:px-0
        xl:pt-20
        xl:pb-8

        ${!isOpen ? 'hidden lg:flex' : 'flex'}
      `}
    >
      <div
        data-only-container="true"
        className="
          w-full
          flex flex-col
          items-start
          mx-auto

          mt-14
          sm:mt-16
          md:mt-16

          lg:max-w-[520px]
          lg:my-auto

          xl:max-w-[500px]
        "
      >
        {/* Welcome: centred on small screens, aligned with the form on large ones */}
        <div
          className="
            w-[90%]
            flex flex-col
            items-center
            mx-auto

            md:w-[86%]

            lg:w-[90%]
            lg:items-start
          "
        >
          <img
            src="/teacher-welcome-illustration.png"
            alt=""
            aria-hidden="true"
            className="
              h-[112px]
              w-auto
              max-w-full
              object-contain

              sm:h-[132px]
              md:h-[150px]

              lg:hidden
            "
          />

          <h1
            className="
              mt-3
              text-[28px]
              font-bold
              leading-tight
              text-center

              text-slate-800
              sm:text-3xl
              lg:mt-0
              lg:text-4xl
              lg:text-left
            "
          >
            {hasVisited ? 'Welcome back!' : 'Welcome to Diraya!'}
          </h1>

          <p className="mt-2 text-sm font-medium text-center text-gray-500 lg:text-[15px] lg:text-left">
            {hasVisited
              ? 'Sign in to continue to your account'
              : 'Sign in to your account, or create one to get started.'}
          </p>
        </div>

        {/* Good news from another screen (hidden once an error needs the space) */}
        {notice && !loginError && (
          <div
            role="status"
            className="
              w-full
              mt-5
              flex items-start
              gap-2.5
              px-4 py-3
              bg-emerald-50
              border border-emerald-200
              rounded-lg
              text-sm
              text-emerald-800

              md:w-[90%]
              md:mx-auto
            "
          >
            <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600" />
            <span>{notice}</span>
          </div>
        )}

        {/* Sign-in error from the server */}
        {loginError && (
          <div
            role="alert"
            className="
              w-full
              mt-5
              flex items-start
              gap-2.5
              px-4 py-3
              bg-red-50
              border border-red-200
              rounded-lg
              text-sm
              text-red-700

              md:w-[90%]
              md:mx-auto
            "
          >
            <AlertCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />

            <div className="flex-1">
              <span>{loginError}</span>

              {/* Only for the "email not confirmed" error. */}
              {unverifiedEmail &&
                (resendStatus === 'sent' ? (
                  <span className="block mt-1 font-semibold">
                    A new link is on its way to {unverifiedEmail}.
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendStatus === 'sending'}
                    className="
                      block mt-1

                      font-semibold
                      underline
                      cursor-pointer
                      rounded-sm

                      hover:no-underline

                      focus-visible:outline-none
                      focus-visible:ring-2
                      focus-visible:ring-red-400

                      disabled:cursor-not-allowed
                      disabled:opacity-60
                    "
                  >
                    {resendStatus === 'sending' ? 'Sending...' : 'Send the confirmation email again'}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Form */}
        <form
          onFocus={handleFormFocus}
          onSubmit={handleSubmit}
          noValidate
          className="
            w-full
            flex flex-col
            mx-auto
            mt-6

            md:w-[90%]
            lg:mt-10
            tall:mt-12
          "
        >
          <AuthTextField
            id="email-address"
            label="Email address"
            icon={MailIcon}
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            error={fieldErrors.email}
            disabled={isBusy}
            onFocus={() => clearFieldError('email')}
            onChange={(e) => handleFieldChange('email', e.target.value)}
          />

          <AuthTextField
            className="mt-5 lg:mt-7 tall:mt-9"
            id="password"
            label="Password"
            icon={LockIcon}
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            error={fieldErrors.password}
            disabled={isBusy}
            onFocus={() => clearFieldError('password')}
            onChange={(e) => handleFieldChange('password', e.target.value)}
          />

          <div className="w-full flex flex-col gap-5 mt-5 tall:gap-6 tall:mt-7">
            {/* Remember me (sent with the sign-in request) and Forgot password */}
            <div className="w-full flex justify-between items-center gap-3 text-sm">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="remember-me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isBusy}
                  className="
                    w-4 h-4
                    mr-2
                    accent-[#3431E4]
                    cursor-pointer
                    disabled:cursor-not-allowed
                  "
                />

                <label
                  htmlFor="remember-me"
                  className="font-medium text-gray-700 cursor-pointer"
                >
                  Remember me
                </label>
              </div>

              {/* A button, not a link: it opens a window on this page and
                  does not navigate anywhere. */}
              <button
                type="button"
                onClick={() => onForgotPassword(email)}
                disabled={isBusy}
                className="
                  text-[#3431E4]
                  font-medium

                  cursor-pointer
                  transition-colors

                  hover:text-[#2926C2]
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
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isBusy}
              aria-busy={isSubmitting}
              className="
                w-full h-[50px]

                flex items-center justify-center gap-2
                px-6

                bg-[#3431E4]
                text-white
                text-sm
                font-semibold

                rounded-md
                shadow-sm

                transition-all duration-200

                hover:bg-[#2926C2]
                hover:shadow-md

                active:scale-[0.995]

                focus-visible:outline-none
                focus-visible:ring-2
                focus-visible:ring-[#3431E4]
                focus-visible:ring-offset-2

                disabled:cursor-not-allowed
                disabled:opacity-80
                disabled:hover:bg-[#3431E4]
                disabled:hover:shadow-sm

                xl:h-[46px]
              "
            >
              {isSubmitting ? (
                <>
                  <PencilLoader />
                  <span aria-live="polite">Signing in...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </div>
        </form>

        {/* "or" divider, Google button, sign-up link and demo link */}
        <SignInAlternatives
          disabled={isBusy}
          isDemoLoading={isDemoLoading}
          isGoogleSubmitting={isGoogleSubmitting}
          demoError={demoError}
          onSignUp={onSignUp}
          onTryDemo={handleTryDemo}
          onGoogleCode={handleGoogleCode}
          onGoogleError={handleGoogleError}
        />
      </div>
    </section>
  );
}

export default SignInLeftSection;
