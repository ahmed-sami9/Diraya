// hooks/useDemoLogin.ts
// hooks/useDemoLogin.ts
import { useEffect, useState } from 'react';
import useTeacherLogin from './useTeacherLogin';
import type { User } from '../context/AuthContext';

const MIN_LOADING_MS = 400;

function useDemoLogin(onAuthSuccess: (user: User) => void) {
  const { login } = useTeacherLogin();
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
      const user = await login({
        email: import.meta.env.VITE_DEMO_EMAIL,
        password: import.meta.env.VITE_DEMO_PASSWORD,
        rememberMe: false,
      });

      await waitForMinimum();
      onAuthSuccess(user);
    } catch (error) {
      console.error(error);
      await waitForMinimum();
      setDemoError('Could not load the demo. Please try again.');
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
