import { useEffect, useRef, useState } from 'react';

import GoogleSignInButton from './GoogleSignInButton.tsx';

interface SignInAlternativesProps {
  // True while a sign-in, Google or demo request is running.
  disabled: boolean;
  isDemoLoading: boolean;
  isGoogleSubmitting: boolean;
  demoError: string | null;
  onSignUp: () => void;
  onTryDemo: () => void;
  onGoogleCode: (code: string) => void;
  onGoogleError: (message: string) => void;
}

// Short pause before the sign-up modal opens, with a spinner next to the link.
const SIGN_UP_DELAY_MS = 400;

// Shared by the two text links at the bottom ("Sign Up" and "Try the demo").
const textLinkClasses = `
  text-[#3431E4]
  font-semibold

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

// Everything under the sign-in form: the "or" divider, Google, the sign-up
// link and the demo link.
function SignInAlternatives({
  disabled,
  isDemoLoading,
  isGoogleSubmitting,
  demoError,
  onSignUp,
  onTryDemo,
  onGoogleCode,
  onGoogleError,
}: SignInAlternativesProps) {
  const [isOpeningSignUp, setIsOpeningSignUp] = useState(false);
  const signUpTimer = useRef<number | null>(null);

  // Cancel the pending timer if the component unmounts mid-delay.
  useEffect(() => {
    return () => {
      if (signUpTimer.current !== null) {
        window.clearTimeout(signUpTimer.current);
      }
    };
  }, []);

  const handleSignUpClick = () => {
    if (disabled || isOpeningSignUp) return;

    setIsOpeningSignUp(true);

    signUpTimer.current = window.setTimeout(() => {
      signUpTimer.current = null;
      setIsOpeningSignUp(false);
      onSignUp();
    }, SIGN_UP_DELAY_MS);
  };

  return (
    <div
      className="
        w-full
        flex flex-col
        items-start
        mt-5
        mx-auto

        md:w-[90%]
        lg:mt-7
        tall:mt-9
      "
    >
      {/* Divider */}
      <div className="w-full flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-300" />
        <span className="text-sm text-gray-400">or</span>
        <div className="h-px flex-1 bg-gray-300" />
      </div>

      {/* Google */}
      <GoogleSignInButton
        className="mt-4 tall:mt-6"
        disabled={disabled}
        isSubmitting={isGoogleSubmitting}
        onCode={onGoogleCode}
        onError={onGoogleError}
      />

      {/* Sign up */}
      <p className="mx-auto mt-5 text-sm font-medium text-gray-500 tall:mt-7">
        Don't have an account?{' '}
        <button
          type="button"
          onClick={handleSignUpClick}
          disabled={disabled}
          aria-busy={isOpeningSignUp}
          className={`relative ${textLinkClasses}`}
        >
          Sign Up
          {/* Positioned outside the text flow so the centred line doesn't shift. */}
          {isOpeningSignUp && <Spinner className="absolute left-full top-1/2 ml-1.5 -mt-[7px]" />}
        </button>
      </p>

      {/* Demo */}
      <p className="mx-auto mt-4 text-sm font-medium text-gray-500">
        Just looking around?{' '}
        <button
          type="button"
          onClick={onTryDemo}
          disabled={disabled}
          className={`group inline-flex items-center gap-1 ${textLinkClasses}`}
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
      </p>

      {demoError && (
        <p
          role="alert"
          className="mx-auto mt-3 text-xs font-medium text-red-600"
        >
          {demoError}
        </p>
      )}
    </div>
  );
}

export default SignInAlternatives;
