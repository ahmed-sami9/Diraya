import { useGoogleLogin } from '@react-oauth/google';

import PencilLoader from '../../../components/PencilLoader.tsx';

interface GoogleSignInButtonProps {
  // True while any other request is running.
  disabled: boolean;
  // True while our backend is exchanging and checking Google's code.
  isSubmitting: boolean;
  // Called with Google's one-time authorization code. The parent sends it to
  // the backend, which is the only place it can be turned into a sign-in.
  onCode: (code: string) => void;
  onError: (message: string) => void;
  // Spacing classes from the parent, so the button fits both the sign-in
  // section and the sign-up window.
  className?: string;
}

// Our own "Continue with Google" button.
//
// The button is plain HTML that we style ourselves. Clicking it asks Google to
// open its sign-in window, which is the part that stays Google's: the person
// picks an account and types their password there, never on our page.
//
// Because the button is ours, Google does not hand it a finished identity
// token. It returns a one-time code instead (the "auth-code" flow). That code
// is useless by itself: only our backend, which holds the client secret, can
// exchange it for the person's identity.
function GoogleSignInButton({
  disabled,
  isSubmitting,
  onCode,
  onError,
  className = '',
}: GoogleSignInButtonProps) {
  const openGoogleWindow = useGoogleLogin({
    flow: 'auth-code',

    // Always show Google's account chooser, so nobody is signed in as
    // whichever Google account happens to be open in this browser.
    select_account: true,

    onSuccess: ({ code }) => onCode(code),

    // Google answered with an error. "access_denied" means the person pressed
    // Cancel on Google's screen, which is a choice and not a failure.
    onError: ({ error }) => {
      if (error === 'access_denied') return;

      onError('Google sign-in could not be completed. Please try again.');
    },

    // The window never reached Google. Closing it is also a choice, so only
    // a blocked popup is reported.
    onNonOAuthError: ({ type }) => {
      if (type === 'popup_failed_to_open') {
        onError('Your browser blocked the Google window. Allow pop-ups for this site and try again.');
      }
    },
  });

  return (
    <button
      type="button"
      onClick={() => openGoogleWindow()}
      disabled={disabled}
      aria-busy={isSubmitting}
      className={`
        w-full h-[50px]

        flex items-center justify-center gap-2

        text-sm
        font-semibold
        text-slate-800

        bg-white

        border border-gray-300
        rounded-md

        shadow-sm shadow-gray-200

        cursor-pointer
        transition-all duration-200

        hover:bg-gray-50
        hover:border-gray-400
        hover:shadow-md

        active:scale-[0.995]

        focus-visible:outline-none
        focus-visible:ring-2
        focus-visible:ring-[#3431E4]
        focus-visible:ring-offset-2

        disabled:cursor-not-allowed
        disabled:opacity-60
        disabled:hover:bg-white
        disabled:hover:border-gray-300
        disabled:hover:shadow-sm

        xl:h-[46px]

        ${className}
      `}
    >
      {isSubmitting ? (
        <>
          <PencilLoader />
          <span aria-live="polite">Signing in with Google…</span>
        </>
      ) : (
        <>
          <img
            src="/google-logo.png"
            alt=""
            aria-hidden="true"
            className="w-5 h-5"
          />
          Continue with Google
        </>
      )}
    </button>
  );
}

export default GoogleSignInButton;
