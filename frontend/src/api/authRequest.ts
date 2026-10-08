// One helper for the auth requests that send JSON and read JSON back.
//
// Every error thrown here carries a message written for users, so callers
// can show `error.message` as it is.

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '');

const CONNECTION_ERROR = 'Could not reach the server. Please check your connection.';
const SERVER_ERROR = 'Something went wrong on our side. Please try again.';
const RATE_LIMIT_ERROR = 'Too many attempts. Please wait a few minutes and try again.';

export type ApiResponse<T> = {
  status: number;
  // True for 2xx answers. A 4xx answer is returned, not thrown, so each
  // caller can decide what that status means for its own request.
  ok: boolean;
  data: (T & { message?: string }) | null;
};

export async function postJson<T = unknown>(
  path: string,
  body: unknown = {},
  signal?: AbortSignal
): Promise<ApiResponse<T>> {
  if (!apiUrl) {
    throw new Error('The API URL is not configured.');
  }

  let response: Response;

  try {
    response = await fetch(`${apiUrl}${path}`, {
      method: 'POST',
      // Sends and accepts the session cookie.
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    // A cancelled request is not a failure. Let the caller see the abort.
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    throw new Error(CONNECTION_ERROR);
  }

  const data = await response.json().catch(() => null);

  if (response.status === 429) {
    throw new Error(RATE_LIMIT_ERROR);
  }

  if (response.status >= 500) {
    throw new Error(SERVER_ERROR);
  }

  return { status: response.status, ok: response.ok, data };
}
