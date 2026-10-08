import { ApiError } from '../api/apiClient';

// What went wrong, in the three kinds the error screens care about:
//
//   offline  the device has no network. Nothing we can fix; the person can.
//   server   our server didn't answer, or crashed (no response, or 5xx).
//            Not the person's fault, and they should be told so.
//   other    anything else. Rare on a load, since 4xx answers (invalid
//            input, not found, taken name) are handled where they happen.
export type ConnectionProblem = 'offline' | 'server' | 'other';

// True when the server failed to do its job, as opposed to refusing a
// request on purpose (4xx). Status 0 means no answer at all.
export function isServerUnavailable(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || error.status >= 500);
}

export function getConnectionProblem(error: unknown, isOnline: boolean): ConnectionProblem {
  if (!isOnline) return 'offline';
  if (isServerUnavailable(error)) return 'server';

  return 'other';
}

// The words for each kind, kept in one place so every error screen says
// the same thing for the same problem.
export const CONNECTION_COPY = {
  offline: {
    title: 'You’re offline',
    message:
      'Check your internet connection. Diraya will reconnect by itself as soon as you’re back online.',
  },
  server: {
    title: 'Diraya isn’t responding',
    message: 'This is on our side, not yours. Please try again in a moment.',
  },
} as const;
