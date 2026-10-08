import type { User } from '../context/AuthContext';

type GoogleLoginInput = {
  credential: string;
  rememberMe: boolean;
};

type GoogleLoginResponse = {
  user?: User;
  code?: string;
  message?: string;
};

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '');

export async function googleLoginRequest(input: GoogleLoginInput): Promise<User> {
  if (!apiUrl) {
    throw new Error('The API URL is not configured.');
  }

  let response: Response;

  try {
    response = await fetch(`${apiUrl}/auth/google`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error('Could not reach the server. Please check your connection.');
  }

  const data: GoogleLoginResponse | null = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status >= 500) {
      throw new Error('Google sign-in is temporarily unavailable. Please try again.');
    }

    throw new Error(data?.message ?? 'Google sign-in failed. Please try again.');
  }

  if (!data?.user) {
    throw new Error('The server returned an invalid login response.');
  }

  return data.user;
}
