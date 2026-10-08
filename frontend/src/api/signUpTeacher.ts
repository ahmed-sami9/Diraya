import { AuthError } from './authErrors';

export const signUpTeacher = async (credentials: {
  email: string;
  password: string;
  fullName: string;
}) => {
  let res: Response;

  try {
    res = await fetch('http://localhost:5000/api/v1/auth/signup', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    console.log(res);
  } catch {
    // Server down, offline, CORS: fetch rejects and never returns a Response,
    // so this case never reaches the res.ok check below.
    throw new AuthError(
      'SERVER_ERROR',
      "We can't reach the server right now. Check your connection and try again."
    );
  }

  if (!res.ok) {
    // 409 Conflict = email already registered.
    // If your backend signals this differently, check the body instead, e.g.:
    //   const body = await res.json().catch(() => null);
    //   if (body?.code === 'EMAIL_IN_USE') { ... }
    if (res.status === 409) {
      throw new AuthError('EMAIL_TAKEN', 'An account with this email already exists.');
    }
    throw new AuthError(
      'SERVER_ERROR',
      "Your account wasn't created because something went wrong on our side. Try again in a moment."
    );
  }
  const data = await res.json();
  return data.user;
};
