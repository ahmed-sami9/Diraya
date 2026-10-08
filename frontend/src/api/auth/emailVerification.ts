// The two requests of the "confirm your email" flow that follows sign-up.

import type { User } from '../../context/AuthContext';
import { postJson } from './authRequest';

// Thrown when the link is wrong, already used or expired.
export class InvalidVerificationLinkError extends Error {}

// Uses the link from the email. On success the server marks the account as
// confirmed, sets the session cookie, and returns the signed-in user.
export async function verifyEmail(token: string): Promise<User> {
  const response = await postJson<{ user?: User }>('/auth/email/verify', { token });

  if (response.ok && response.data?.user) {
    return response.data.user;
  }

  throw new InvalidVerificationLinkError(
    response.data?.message ?? 'This confirmation link is invalid or has expired.'
  );
}

// Asks for a new confirmation email. The server answers the same way whether
// or not the email is waiting to be confirmed.
export async function resendVerificationEmail(email: string): Promise<void> {
  const response = await postJson('/auth/email/verification/resend', { email });

  if (!response.ok) {
    throw new Error('Please enter a valid email address.');
  }
}
