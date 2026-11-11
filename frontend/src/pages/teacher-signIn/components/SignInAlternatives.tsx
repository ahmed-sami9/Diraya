import { useEffect, useRef, useState } from 'react';

import GoogleSignInButton from './GoogleSignInButton.tsx';

interface SignInAlternativesProps {
  // True while a sign-in, sign-up, Google or demo request is running.
  disabled: boolean;
  isDemoLoading: boolean;
  isGoogleSubmitting: boolean;
  demoError: string | null;
  // Shown under the Google button (the sign-in form shows its own instead).
  googleError?: string | null;
  // The link to the other form: "Don't have an account? Sign Up" on sign-in,
  // "Already have an account? Sign in" in the sign-up window.
  switchPrompt: string;
  switchLabel: string;
  onSwitch: () => void;
  // Sign-in waits a moment (with a spinner) before opening the sign-up window.
  delaySwitch?: boolean;
  onTryDemo: () => void;
  onGoogleCode: (code: string) => void;
  onGoogleError: (message: string) => void;
  // The wrapper's width and spacing, which differ between the page and the window.
  className?: string;
}

// The pause before the switch, when delaySwitch is on.
const SWITCH_DELAY_MS = 400;

// Shared by the two text links at the bottom (the switch and "Try the demo").
const textLinkClasses = `
  text-primary
  font-semibold

  cursor-pointer
  transition-colors

  hover:text-primary-hover
  hover:underline

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-primary
  focus-visible:ring-offset-2 focus-visible:ring-offset-surface

  rounded-sm

  disabled:opacity-60
  disabled:cursor-not-allowed
`;

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`w-3.5 h-3.5 animate-spin ${className}`}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`w-4 h-4 ${className}`}
    >
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  );
}

// Everything under the sign-in and sign-up forms: the "or" divider, Google,
// the link to the other form and the demo link.
function SignInAlternatives({
  disabled,
  isDemoLoading,
  isGoogleSubmitting,
  demoError,
  googleError,
  switchPrompt,
  switchLabel,
  onSwitch,
  delaySwitch = false,
  onTryDemo,
  onGoogleCode,
  onGoogleError,
  className = 'mt-5 mx-auto md:w-[90%] lg:mt-7 tall:mt-9 short:mt-4',
}: SignInAlternativesProps) {
  const [isSwitching, setIsSwitching] = useState(false);
  const switchTimer = useRef<number | null>(null);

  // Cancel the pending timer if the component unmounts mid-delay.
  useEffect(() => {
    return () => {
      if (switchTimer.current !== null) {
        window.clearTimeout(switchTimer.current);
      }
    };
  }, []);

  const handleSwitchClick = () => {
    if (disabled || isSwitching) return;

    if (!delaySwitch) {
      onSwitch();
      return;
    }

    setIsSwitching(true);

    switchTimer.current = window.setTimeout(() => {
      switchTimer.current = null;
      setIsSwitching(false);
      onSwitch();
    }, SWITCH_DELAY_MS);
  };

  return (
    <div className={`w-full flex flex-col items-start ${className}`}>
      {/* Divider */}
      <div className="w-full flex items-center gap-3">
        <div className="h-px flex-1 bg-border-strong" />
        <span className="text-sm text-ink-muted">or</span>
        <div className="h-px flex-1 bg-border-strong" />
      </div>

      {/* Google */}
      <GoogleSignInButton
        className="mt-4 tall:mt-6"
        disabled={disabled}
        isSubmitting={isGoogleSubmitting}
        onCode={onGoogleCode}
        onError={onGoogleError}
      />

      {googleError && (
        <p
          role="alert"
          className="mx-auto mt-3 text-xs font-medium text-danger"
        >
          {googleError}
        </p>
      )}

      {/* The demo: most visitors want to look around first, so it's a real
          button rather than a small link at the bottom. */}
      <button
        type="button"
        onClick={onTryDemo}
        disabled={disabled}
        aria-busy={isDemoLoading}
        className="
          group
          mt-3 w-full h-[50px]
          flex items-center justify-center gap-2
          rounded-md
          bg-primary-tint
          text-sm font-semibold text-primary
          cursor-pointer
          transition-colors duration-200
          hover:bg-primary/15
          focus-visible:outline-none
          focus-visible:ring-2 focus-visible:ring-primary
          focus-visible:ring-offset-2 focus-visible:ring-offset-surface
          disabled:cursor-not-allowed disabled:opacity-60
          xl:h-[46px]
        "
      >
        {isDemoLoading ? (
          'Loading demo…'
        ) : (
          <>
            Try the demo
            <ArrowIcon className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </>
        )}
      </button>
      <p className="mx-auto mt-2 text-xs text-ink-muted">
        No sign-up. A real account with sample data, yours to edit for a day.
      </p>

      {demoError && (
        <p
          role="alert"
          className="mx-auto mt-3 text-xs font-medium text-danger"
        >
          {demoError}
        </p>
      )}

      {/* The other form */}
      <p className="mx-auto mt-5 text-sm font-medium text-ink-muted tall:mt-7 short:mt-3">
        {switchPrompt}{' '}
        <button
          type="button"
          onClick={handleSwitchClick}
          disabled={disabled}
          aria-busy={isSwitching}
          className={`relative ${textLinkClasses}`}
        >
          {switchLabel}
          {/* Positioned outside the text flow so the centred line doesn't shift. */}
          {isSwitching && <Spinner className="absolute left-full top-1/2 ml-1.5 -mt-[7px]" />}
        </button>
      </p>
    </div>
  );
}

export default SignInAlternatives;
