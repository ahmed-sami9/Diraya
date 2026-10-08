import React, {
  useContext,
  createContext,
  useEffect,
  type Dispatch,
  type SetStateAction,
} from 'react';

import { getCurrentUser } from '../api/getCurrentUser';

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'teacher' | 'student';
};

type AuthContextType = {
  user: User | null;

  setUser: Dispatch<SetStateAction<User | null>>;

  isAuthChecking: boolean;

  authCheckError: string | null;

  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = React.useState<User | null>(null);

  const [isAuthChecking, setIsAuthChecking] = React.useState(true);

  const [authCheckError, setAuthCheckError] = React.useState<string | null>(null);

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

        const currentUser = await getCurrentUser(controller.signal);

        setUser(currentUser);
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

  const logout = async () => {
    // Later:
    // await logoutRequest();

    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        isAuthChecking,
        authCheckError,
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
