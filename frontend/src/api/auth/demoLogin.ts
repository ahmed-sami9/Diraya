import type { User } from '../../context/AuthContext';
import { postJson } from './authRequest';

// Asks the server for a demo session. The server creates a brand-new
// temporary teacher for this visitor, fills it with sample data, sets the
// session cookie, and returns the user.
//
// Nothing is sent: there is no demo email or password any more.
export async function demoLoginRequest(): Promise<User> {
  const response = await postJson<{ user?: User }>('/auth/demo');

  if (response.ok && response.data?.user) {
    return response.data.user;
  }

  throw new Error('Could not load the demo. Please try again.');
}
