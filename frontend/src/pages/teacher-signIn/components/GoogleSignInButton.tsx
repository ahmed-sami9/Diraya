import { useEffect, useRef, useState } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';

import PencilLoader from '../../../components/PencilLoader.tsx';

interface GoogleSignInButtonProps {
  // True while any other request is running. The button stays visible but
  // cannot be clicked.
  disabled: boolean;
  // True while our backend is checking the credential Google returned.
  isSubmitting: boolean;
  // Called with Google's ID token. The parent sends it to the backend.
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
  // Spacing classes from the parent, so the button fits both the sign-in
  // section and the sign-up window.
  className?: string;
}

// Google draws this button itself, inside an iframe, and only accepts a fixed
// pixel width between these two values. It cannot be set to "100%".
const MIN_BUTTON_WIDTH = 200;
const MAX_BUTTON_WIDTH = 400;

// Measures the wrapper so the Google button can be as wide as Google allows
// on every screen size, and re-measures when the layout changes.
const useButtonWidth = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const available = Math.floor(container.clientWidth);
      setWidth(Math.min(MAX_BUTTON_WIDTH, Math.max(MIN_BUTTON_WIDTH, available)));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  return { containerRef, width };
};

function GoogleSignInButton({
  disabled,
  isSubmitting,
  onCredential,
  onError,
  className = '',
}: GoogleSignInButtonProps) {
  const { containerRef, width } = useButtonWidth();

  const handleSuccess = (response: CredentialResponse) => {
    if (!response.credential) {
      onError('Google did not return a sign-in credential. Please try again.');
      return;
    }

    onCredential(response.credential);
  };

  const handleError = () => {
    onError('Google sign-in could not be completed. Please try again.');
  };

  return (
    <div
      ref={containerRef}
      className={`
        relative
        w-full min-h-[50px]

        flex items-center justify-center

        xl:min-h-[46px]

        ${className}
      `}
    >
      {/* The Google button stays mounted the whole time, so it never reloads
          or makes the layout jump. While busy it is dimmed and unclickable;
          while Google sign-in is being verified it is hidden behind the
          status message below. */}
      <div
        className={`
          transition-opacity duration-200

          ${disabled ? 'pointer-events-none opacity-60' : ''}
          ${isSubmitting ? 'invisible' : ''}
        `}
      >
        {width !== null && (
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={handleError}
            text="continue_with"
            theme="outline"
            size="large"
            shape="rectangular"
            width={String(width)}
            use_fedcm_for_button
          />
        )}
      </div>

      {isSubmitting && (
        <div
          role="status"
          className="
            absolute inset-0

            flex items-center justify-center gap-2

            text-sm text-gray-500
          "
        >
          <PencilLoader />
          <span>Signing in with Google…</span>
        </div>
      )}
    </div>
  );
}

export default GoogleSignInButton;
