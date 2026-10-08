import { useEffect, useState } from 'react';

import { demoLoginRequest } from '../api/demoLogin';
import type { User } from '../context/AuthContext';

// Keeps the loading state on screen long enough to avoid a flicker.
const MIN_LOADING_MS = 400;

// "Try the demo". Used by both the sign-in section and the sign-up window.
//
// Each click gets the visitor their own temporary account from the server,
// so there are no shared demo credentials in the frontend.
function useDemoLogin(onAuthSuccess: (user: User) => void) {
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  // Any click or key press dismisses the demo error.
  useEffect(() => {
    if (!demoError) return;

    const dismiss = () => setDemoError(null);

    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', dismiss);

    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', dismiss);
    };
  }, [demoError]);

  const tryDemo = async () => {
    if (isDemoLoading) return;

    setDemoError(null);
    setIsDemoLoading(true);

    const startedAt = Date.now();
    const waitForMinimum = () => {
      const remaining = MIN_LOADING_MS - (Date.now() - startedAt);
      return new Promise<void>((resolve) => setTimeout(resolve, Math.max(remaining, 0)));
    };

    try {
      const user = await demoLoginRequest();

      await waitForMinimum();
      onAuthSuccess(user);
    } catch (error) {
      console.error(error);
      await waitForMinimum();

      // demoLoginRequest only throws messages written for users (for example
      // the "too many attempts" one), so they are safe to show.
      setDemoError(
        error instanceof Error ? error.message : 'Could not load the demo. Please try again.'
      );
    } finally {
      setIsDemoLoading(false);
    }
  };

  return {
    tryDemo,
    isDemoLoading,
    demoError,
    clearDemoError: () => setDemoError(null),
  };
}

export default useDemoLogin;
