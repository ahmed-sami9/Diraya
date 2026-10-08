import React, {
  useContext,
  createContext,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react';

import { getCurrentUser } from '../api/auth/getCurrentUser';
import { logoutRequest } from '../api/auth/logout';

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'teacher' | 'student';
  // True for a temporary account created by "Try the demo". Use it to show a
  // "you are in a demo" notice, or to hide settings that make no sense there.
  isDemo?: boolean;
};

type AuthContextType = {
  user: User | null;

  setUser: Dispatch<SetStateAction<User | null>>;

  isAuthChecking: boolean;

  authCheckError: string | null;

  // Asks the server again after the first check failed. Resolves to true
  // when it got an answer (signed in or not), false when it still failed.
  retryAuthCheck: () => Promise<boolean>;

  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

// Name of the channel the tabs of this site use to talk to each other.
const AUTH_CHANNEL_NAME = 'diraya-auth';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = React.useState<User | null>(null);

  const [isAuthChecking, setIsAuthChecking] = React.useState(true);

  const [authCheckError, setAuthCheckError] = React.useState<string | null>(null);

  // The user id the server last confirmed for this tab (null = signed out).
  // It lets us tell apart "this tab signed in or out" (other tabs must be
  // told) from "the server told us" (nothing to announce).
  const confirmedUserId = useRef<string | null>(null);

  const authChannel = useRef<BroadcastChannel | null>(null);

  // Asks the server who is signed in and stores the answer. The server is the
  // only source of truth: tabs never send each other user data.
  const checkSession = async (signal?: AbortSignal) => {
    const currentUser = await getCurrentUser(signal);

    confirmedUserId.current = currentUser?.id ?? null;

    // Keep the same object when nothing changed, so the app doesn't re-render.
    setUser((previous) => (previous?.id === currentUser?.id ? previous : currentUser));

    // The server answered, so any earlier "couldn't reach it" is over. This
    // also lets the background re-checks below recover by themselves.
    setAuthCheckError(null);
  };

  // Used by the "Try again" buttons. Only one request instead of reloading
  // the whole page, so it's quick and the screen doesn't flash white.
  const retryAuthCheck = async () => {
    try {
      await checkSession();

      return true;
    } catch (error) {
      console.error(error);

      return false;
    }
  };

  /*
   * Runs when the React application starts.
   *
   * Its job is to ask:
   *
   * "Does this browser already have a valid
   * authenticated session?"
   */
  useEffect(() => {
    const controller = new AbortController();

    const restoreSession = async () => {
      try {
        setAuthCheckError(null);

        await checkSession(controller.signal);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error(error);

        setAuthCheckError('Unable to verify your session.');
      } finally {
        if (!controller.signal.aborted) {
          setIsAuthChecking(false);
        }
      }
    };

    restoreSession();

    return () => {
      controller.abort();
    };
  }, []);

  /*
   * Keeps this tab in sync with the others.
   *
   * The cookie is shared by every tab, but `user` above lives in this tab's
   * memory only. So this tab re-asks the server in two situations:
   *
   * 1. Another tab says "sign-in state changed" (instant sync).
   * 2. The user comes back to this tab (also catches a session that expired
   *    while the tab was in the background).
   * 3. The device reconnects to the internet, so an "offline" error screen
   *    clears itself without a click.
   */
  useEffect(() => {
    // On failure (for example the network is down) keep what we have.
    const recheck = () => {
      checkSession().catch(console.error);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') recheck();
    };

    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(AUTH_CHANNEL_NAME) : null;

    authChannel.current = channel;
    channel?.addEventListener('message', recheck);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', recheck);

    return () => {
      authChannel.current = null;
      channel?.close();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', recheck);
    };
  }, []);

  /*
   * Tells the other tabs when THIS tab signed in or out.
   *
   * It watches `user` instead of being called from each sign-in function, so
   * every way of signing in (password, Google, demo, email link) and signing
   * out is covered without touching those files.
   */
  useEffect(() => {
    if (isAuthChecking) return;

    const userId = user?.id ?? null;

    // The change came from the server check, so other tabs already know.
    if (userId === confirmedUserId.current) return;

    confirmedUserId.current = userId;

    // Only a signal. Each tab asks the server itself (see `recheck`).
    authChannel.current?.postMessage('auth-changed');
  }, [user, isAuthChecking]);

  const logout = async () => {
    // Server first: it ends the session and clears the cookie. Only when that
    // has worked do we forget the user here. If the request fails it throws,
    // and the user stays signed in on screen, which is the truth: the cookie
    // is still valid, so showing "signed out" would be wrong (and unsafe on a
    // shared computer).
    await logoutRequest();

    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        isAuthChecking,
        authCheckError,
        retryAuthCheck,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};
