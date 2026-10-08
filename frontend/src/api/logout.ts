import { postJson } from './authRequest';

// Ends the session on the server and clears the cookie.
//
// Clearing React state alone is not a logout: the cookie would stay in the
// browser, and the next page load would sign the person straight back in.
export async function logoutRequest(): Promise<void> {
  const response = await postJson('/auth/logout');

  if (!response.ok) {
    throw new Error('Could not sign out. Please try again.');
  }
}
