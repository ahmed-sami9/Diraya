import type { User } from '../context/AuthContext';
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
  const res = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',
    },

    credentials: 'include',

    body: JSON.stringify(credentials),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new AuthError(
      data.code ?? 'SERVER_ERROR',
      data.message ?? 'Something went wrong on our side.'
    );
  }

  const successData = data as LoginSuccessResponse;

  return successData.user;
};
