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

// The frontend opens Google's sign-in as a popup. For that kind of sign-in
// Google expects this fixed word in place of a real redirect URL.
const POPUP_REDIRECT_URI = 'postmessage';

function getRequiredEnv(name: 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET'): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} environment variable is missing.`);
  }

  return value;
}

// Turns the one-time code from Google's sign-in window into a Google profile.
//
// Two steps, both between this server and Google:
//
//   1. Exchange. We send Google the code together with our client secret.
//      The secret proves the request comes from Diraya's server, so a code
//      stolen from a browser is useless to anyone else. Google answers with
//      an ID token, a signed statement of who the person is.
//
//   2. Verify. We check the token's signature and expiry, and that its
//      "audience" is OUR client ID, so a token issued for another website
//      can never be accepted here.
export async function getGoogleProfileFromCode(code: string): Promise<GoogleProfile> {
  // Missing configuration must remain a server error, so read it outside
  // the try/catch below.
  const clientId = getRequiredEnv('GOOGLE_CLIENT_ID');
  const clientSecret = getRequiredEnv('GOOGLE_CLIENT_SECRET');

  const client = new OAuth2Client(clientId, clientSecret, POPUP_REDIRECT_URI);

  let payload;

  try {
    const { tokens } = await client.getToken(code);

    if (!tokens.id_token) {
      throw new Error('Google did not return an ID token.');
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: clientId,
    });

    payload = ticket.getPayload();
  } catch (error) {
    // Typical causes: the code was already used, expired, or is fake.
    console.error(
      'Google sign-in failed:',
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
