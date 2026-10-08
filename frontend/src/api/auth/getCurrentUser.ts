import type { User } from '../../context/AuthContext';

type CurrentUserResponse = {
  user: User;
};

export async function getCurrentUser(signal?: AbortSignal): Promise<User | null> {
  const response = await fetch('http://localhost:5000/api/v1/auth/me', {
    method: 'GET',
    credentials: 'include',
    signal,
  });

  // Cookie doesn't exist, expired,
  // or isn't valid anymore.
  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Unable to verify authentication');
  }

  const data: CurrentUserResponse = await response.json();

  return data.user;
}
