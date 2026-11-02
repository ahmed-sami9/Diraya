import type { User } from '../../context/AuthContext';
import { apiUrl } from '../apiClient';
import { AuthError } from './authErrors';

type LoginCredentials = {
  email: string;
  password: string;
  rememberMe: boolean;
};

type LoginSuccessResponse = {
  message: string;
  user: User;
};

export const logInTeacher = async (credentials: LoginCredentials): Promise<User> => {
  let res: Response;

  try {
    res = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(credentials),
    });
  } catch {
    // Offline or server down: fetch never returns a Response.
    throw new AuthError(
      'SERVER_ERROR',
      "We can't reach the server right now. Check your connection and try again."
    );
  }

  // A proxy's HTML error page isn't JSON; fall back to the generic message.
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new AuthError(
      data.code ?? 'SERVER_ERROR',
      data.message ?? 'Something went wrong on our side.'
    );
  }

  const successData = data as LoginSuccessResponse;

  return successData.user;
};
