import { AuthError } from './authErrors';

// What the server answers after creating the account. The teacher is NOT
// signed in yet: they first confirm the email address we return here.
export type SignUpResult = {
  email: string;
};

export const signUpTeacher = async (credentials: {
  email: string;
  password: string;
  fullName: string;
}): Promise<SignUpResult> => {
  let res: Response;

  try {
    res = await fetch('http://localhost:5000/api/v1/auth/signup', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
  } catch {
    // Server down, offline, CORS: fetch rejects and never returns a Response,
    // so this case never reaches the res.ok check below.
    throw new AuthError(
      'SERVER_ERROR',
      "We can't reach the server right now. Check your connection and try again."
    );
  }

  const data = await res.json().catch(() => null);

  if (res.ok) {
    return { email: data?.email ?? credentials.email };
  }

  // Each kind of failure gets its own code and its own message, so the form
  // never blames "our side" for something the person can fix.
  if (res.status === 409) {
    throw new AuthError('EMAIL_TAKEN', 'An account with this email already exists.');
  }

  if (res.status === 429) {
    throw new AuthError(
      'TOO_MANY_ATTEMPTS',
      'Too many sign-up attempts. Please wait a while and try again.'
    );
  }

  if (res.status === 400) {
    throw new AuthError(
      'INVALID_INPUT',
      'Some of these details were not accepted. Check your name, email and password and try again.'
    );
  }

  throw new AuthError(
    'SERVER_ERROR',
    "Your account wasn't created because something went wrong on our side. Try again in a moment."
  );
};
