import { useEffect, useRef, useState, type FormEvent } from 'react';

import { MailIcon, XIcon, AlertCircleIcon } from '../../../components/icons/index.ts';
import CheckCircleIcon from '../../../components/icons/CheckCircleIcon.tsx';
import PencilLoader from '../../../components/PencilLoader.tsx';
import useModalBehavior from '../../../hooks/useModalBehavior.ts';
import { requestPasswordReset } from '../../../api/auth/passwordReset.ts';

import AuthTextField from './AuthTextField.tsx';

interface ForgotPasswordModalProps {
  // The email already typed into the sign-in form, if any.
  initialEmail: string;
  onClose: () => void;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

// How long the success message stays before the window starts to fade.
// Long enough to read two short sentences.
const SUCCESS_VISIBLE_MS = 4000;

// How long the fade-out takes. Must match the `duration-500` classes below.
const FADE_OUT_MS = 500;

// Keeps the loading state on screen long enough to avoid a flicker.
const MIN_LOADING_MS = 400;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The window moves through these steps in order:
//   form -> sending -> success -> closing -> (removed by the parent)
type Phase = 'form' | 'sending' | 'success' | 'closing';

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

// Mounted by the parent only while it is open, so every opening starts with
// fresh state and plays the fade-in.
function ForgotPasswordModal({ initialEmail, onClose }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState<string>();
  const [requestError, setRequestError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('form');
  // Stays true through the fade-out, so the success message is what fades.
  const [wasSent, setWasSent] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);

  const isSending = phase === 'sending';
  const isClosing = phase === 'closing';

  /* ------------------------------ Closing ------------------------------- */

  // Closing is two steps: fade out first, then tell the parent to remove us.
  const startClosing = () => {
    // Don't close mid-request: the person would not learn whether it worked.
    if (isSending || isClosing) return;

    setPhase('closing');
  };

  const panelRef = useModalBehavior<HTMLDivElement>({
    onRequestClose: startClosing,
    initialFocusRef: emailInputRef,
  });

  // After the success message has been visible long enough, fade out.
  useEffect(() => {
    if (phase !== 'success') return;

    const timer = window.setTimeout(() => setPhase('closing'), SUCCESS_VISIBLE_MS);

    return () => window.clearTimeout(timer);
  }, [phase]);

  // When the fade-out has finished, the parent unmounts the window.
  useEffect(() => {
    if (phase !== 'closing') return;

    const timer = window.setTimeout(onClose, FADE_OUT_MS);

    return () => window.clearTimeout(timer);
  }, [phase, onClose]);

  /* ------------------------------ Submit -------------------------------- */

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (phase !== 'form') return;

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setEmailError('Email is required');
      return;
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setEmailError('Enter a valid email');
      return;
    }

    setRequestError(null);
    setPhase('sending');

    const startedAt = Date.now();
    const waitForMinimumLoading = () =>
      new Promise<void>((resolve) =>
        setTimeout(resolve, Math.max(MIN_LOADING_MS - (Date.now() - startedAt), 0))
      );

    try {
      await requestPasswordReset(trimmedEmail);

      await waitForMinimumLoading();

      setWasSent(true);
      setPhase('success');
    } catch (error) {
      console.error(error);

      await waitForMinimumLoading();

      // requestPasswordReset only throws messages written for users.
      setRequestError(
        error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      );
      setPhase('form');
    }
  };

  /* ------------------------------- Render ------------------------------- */

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="forgot-password-title"
      onClick={startClosing}
      className={`
        fixed inset-0 z-50
        w-full h-full
        flex items-center justify-center
        px-4

        bg-black/30 backdrop-blur-sm

        transition-opacity duration-500
        starting:opacity-0
        motion-reduce:transition-none

        ${isClosing ? 'opacity-0' : 'opacity-100'}
      `}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className={`
          relative
          w-full max-w-[440px]
          overflow-hidden

          bg-white
          rounded-lg
          shadow-xl
          px-6 py-8

          transition-all duration-500
          starting:opacity-0 starting:scale-95 starting:translate-y-2
          motion-reduce:transition-none

          sm:px-8

          ${isClosing ? 'opacity-0 scale-95 translate-y-2' : 'opacity-100 scale-100 translate-y-0'}
        `}
      >
        {/* Close */}
        <button
          type="button"
          onClick={startClosing}
          disabled={isSending}
          aria-label="Close password reset window"
          className="
            absolute top-5 right-5

            flex items-center justify-center
            w-8 h-8
            rounded-md

            text-gray-400
            cursor-pointer
            transition-colors

            hover:text-gray-600
            hover:bg-gray-100

            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-[#3431E4]

            disabled:opacity-40
            disabled:cursor-not-allowed
          "
        >
          <XIcon />
        </button>

        {wasSent ? (
          /* ------------------------- Success message ------------------------- */
          <div
            role="status"
            className="flex flex-col items-center text-center"
          >
            <span
              className="
                flex items-center justify-center
                w-14 h-14
                rounded-full
                bg-emerald-50
                text-emerald-600

                transition-transform duration-500
                starting:scale-50
                motion-reduce:transition-none
              "
            >
              <CheckCircleIcon className="w-8 h-8" />
            </span>

            <h2
              id="forgot-password-title"
              className="mt-4 text-2xl font-bold text-slate-800"
            >
              Check your inbox
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              If an account exists for{' '}
              <span className="font-semibold text-slate-800 break-all">{email.trim()}</span>, we've
              sent a link to reset your password. It expires in 30 minutes.
            </p>

            <p className="mt-3 text-xs text-gray-500">This window will close by itself.</p>

            {/* Thin bar that empties while the message is visible, so the
                automatic close is expected and not a surprise. */}
            <span
              aria-hidden="true"
              className="
                absolute bottom-0 left-0
                h-1 w-0
                bg-emerald-500

                transition-[width] ease-linear duration-[4000ms]
                starting:w-full
                motion-reduce:hidden
              "
            />
          </div>
        ) : (
          /* ------------------------------ Form ------------------------------- */
          <>
            <h2
              id="forgot-password-title"
              className="pr-8 text-2xl font-bold text-slate-800"
            >
              Forgot your password?
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Enter the email you use for Diraya and we'll send you a link to choose a new
              password.
            </p>

            {requestError && (
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
                <span>{requestError}</span>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              noValidate
              className="flex flex-col mt-6"
            >
              <AuthTextField
                ref={emailInputRef}
                id="forgot-password-email"
                label="Email address"
                icon={MailIcon}
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                error={emailError}
                disabled={isSending}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(undefined);
                  setRequestError(null);
                }}
              />

              <button
                type="submit"
                disabled={isSending}
                aria-busy={isSending}
                className="
                  w-full h-[50px]
                  mt-5

                  flex items-center justify-center gap-2
                  px-6

                  bg-[#3431E4]
                  text-white
                  text-sm
                  font-semibold

                  rounded-md
                  shadow-sm

                  cursor-pointer
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
                {isSending ? (
                  <>
                    <PencilLoader />
                    <span aria-live="polite">Sending link...</span>
                  </>
                ) : (
                  'Send reset link'
                )}
              </button>
            </form>

            <button
              type="button"
              onClick={startClosing}
              disabled={isSending}
              className="
                block
                mx-auto mt-5

                text-sm
                font-semibold
                text-[#3431E4]

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
              "
            >
              Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default ForgotPasswordModal;
