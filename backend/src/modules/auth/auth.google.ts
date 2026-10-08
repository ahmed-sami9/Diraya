import { OAuth2Client } from 'google-auth-library';

import { AuthErrors } from './auth.errors';

// What the rest of the auth module needs to know about a Google user.
export type GoogleProfile = {
  // Google's permanent ID for this account ("sub"). Unlike the email, it
  // never changes, so it is what we store and look teachers up by.
  googleId: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
};

// teachers.full_name is varchar(100).
const MAX_FULL_NAME_LENGTH = 100;

const client = new OAuth2Client();

function getGoogleClientId(): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID environment variable is missing.');
  }

  return clientId;
}

// Checks the ID token the frontend received from Google's button.
//
// The frontend cannot be trusted to say who the user is, so the token is
// verified here: Google's signature, the expiry, and the "audience", which
// must be OUR client ID. Without the audience check, a token issued for any
// other website's Google login would be accepted too.
export async function verifyGoogleCredential(credential: string): Promise<GoogleProfile> {
  // Missing configuration must remain a server error, so read it outside
  // the try/catch below.
  const clientId = getGoogleClientId();

  let payload;

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });

    payload = ticket.getPayload();
  } catch (error) {
    console.error(
      'Google token verification failed:',
      error instanceof Error ? error.message : error
    );

    throw AuthErrors.invalidGoogleToken();
  }

  if (!payload?.sub || !payload.email) {
    throw AuthErrors.invalidGoogleToken();
  }

  const email = payload.email.trim().toLowerCase();

  // Some Google accounts have no display name, so fall back to the part of
  // the email before the "@".
  const fullName = (payload.name?.trim() || email.split('@')[0] || email).slice(
    0,
    MAX_FULL_NAME_LENGTH
  );

  return {
    googleId: payload.sub,
    email,
    emailVerified: payload.email_verified === true,
    fullName,
  };
}
