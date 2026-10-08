// The three requests of the password reset flow.

import { postJson } from './authRequest';

// Step 1. Asks for a reset link. The server answers the same way whether or
// not the email belongs to an account, so success only means "request received".
export async function requestPasswordReset(email: string): Promise<void> {
  const response = await postJson('/auth/password/forgot', { email });

  if (!response.ok) {
    throw new Error('Please enter a valid email address.');
  }
}

// Step 2. Asks whether a reset link still works.
export async function verifyResetToken(token: string, signal?: AbortSignal): Promise<boolean> {
  const response = await postJson<{ valid?: boolean }>(
    '/auth/password/reset/verify',
    { token },
    signal
  );

  return response.ok && response.data?.valid === true;
}

// Thrown when the link is wrong, already used or expired, so the page can
// switch to its "request a new link" screen.
export class InvalidResetLinkError extends Error {}

// Step 3. Saves the new password.
export async function resetPassword(token: string, password: string): Promise<void> {
  const response = await postJson('/auth/password/reset', { token, password });

  if (response.ok) return;

  // The server uses 400 both for a dead link and for a password that breaks
  // the rules. The form already checks the rules, so 400 means the link.
  throw new InvalidResetLinkError(
    response.data?.message ?? 'This reset link is invalid or has expired.'
  );
}
