import { createHash, randomBytes } from 'node:crypto';

// One-time tokens are the secret part of the links we email: password reset
// and email verification both use them.
//
// The email gets the real token. The database only ever gets its hash, so a
// leaked database cannot be turned back into working links.

// The token is a long random value, so a fast hash is enough here. (Passwords
// need a slow hash like argon2 because people choose guessable ones.)
export function hashOneTimeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function createOneTimeToken(): { token: string; tokenHash: string } {
  // 32 random bytes = 256 bits. Impossible to guess.
  const token = randomBytes(32).toString('base64url');

  return { token, tokenHash: hashOneTimeToken(token) };
}
