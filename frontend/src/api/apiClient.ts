// One helper for every dashboard request (grades, students, payments...).
//
// It follows the same rules as authRequest.ts:
//   - the session cookie travels with every request
//   - every error it throws carries a message written for people, so a
//     component can show `error.message` as it is
//
// The difference: authRequest.ts only sends POST and returns 4xx answers to
// the caller. Dashboard requests also need GET, PATCH and DELETE, and are
// simpler to use when every failure is thrown as one error type (ApiError).

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '');

const CONNECTION_ERROR = 'Could not reach the server. Please check your connection.';
const SERVER_ERROR = 'Something went wrong on our side. Please try again.';
const RATE_LIMIT_ERROR = 'Too many requests. Please wait a moment and try again.';
const SESSION_EXPIRED_ERROR = 'Your session has ended. Please sign in again.';
const REQUEST_ERROR = 'Something went wrong. Please try again.';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type RequestOptions = {
  // Sent as JSON. Leave it out for GET and DELETE.
  body?: unknown;
  // Lets the caller cancel the request (for example when the page unmounts).
  signal?: AbortSignal;
};

// The shape the backend uses for error answers: { code, message }.
type ErrorPayload = {
  code?: unknown;
  message?: unknown;
};

// Thrown for every failed request.
//   - message: safe to show to the person
//   - status:  the HTTP status (0 when the server could not be reached)
//   - code:    the machine-readable reason the server sent, for example
//              GRADE_NAME_TAKEN, so a form can put the error on the right field
export class ApiError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);

    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// A cancelled request is not a failure: the caller asked for it to stop.
export const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';

export async function apiRequest<T>(
  method: HttpMethod,
  path: string,
  { body, signal }: RequestOptions = {}
): Promise<T> {
  if (!apiUrl) {
    throw new ApiError('The API URL is not configured.', 0);
  }

  const hasBody = body !== undefined;

  let response: Response;

  try {
    response = await fetch(`${apiUrl}${path}`, {
      method,
      // Sends and accepts the session cookie.
      credentials: 'include',
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new ApiError(CONNECTION_ERROR, 0);
  }

  // 204 No Content (for example a successful delete) has no body to read.
  const data: unknown = response.status === 204 ? null : await response.json().catch(() => null);

  if (response.ok) {
    return data as T;
  }

  if (response.status === 401) {
    throw new ApiError(SESSION_EXPIRED_ERROR, 401, 'UNAUTHENTICATED');
  }

  if (response.status === 429) {
    throw new ApiError(RATE_LIMIT_ERROR, 429, 'TOO_MANY_REQUESTS');
  }

  if (response.status >= 500) {
    throw new ApiError(SERVER_ERROR, response.status);
  }

  // A 4xx answer: use the server's message and code when it sent them.
  const payload = (data ?? {}) as ErrorPayload;

  throw new ApiError(
    typeof payload.message === 'string' ? payload.message : REQUEST_ERROR,
    response.status,
    typeof payload.code === 'string' ? payload.code : null
  );
}
