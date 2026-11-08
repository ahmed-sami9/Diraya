import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import app from '../app';
import { pool } from '../config/db';
import { getFrontendOrigin } from '../config/frontendOrigin';
import { AUTH_COOKIE_NAME } from '../modules/auth/auth.cookie';
import { startTeacherSession } from '../modules/auth/session/auth.session.service';

// Shared setup for API tests: the real app on a free port, and teachers with
// real sessions sent as the real cookie.

export type ApiResponse = { status: number; body: any; headers: Headers };

export type TestServer = {
  // Sends a request the way the browser app does (Origin header, JSON body).
  request: (
    method: string,
    path: string,
    options?: { body?: unknown; cookie?: string; origin?: string }
  ) => Promise<ApiResponse>;
  close: () => void;
};

export function startTestServer(): TestServer {
  const server: Server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;

  return {
    async request(method, path, { body, cookie, origin = getFrontendOrigin() } = {}) {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          origin,
          ...(cookie ? { cookie } : {}),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? null : JSON.stringify(body),
      });
      const text = await response.text();
      return {
        status: response.status,
        body: text ? JSON.parse(text) : null,
        headers: response.headers,
      };
    },
    close: () => server.close(),
  };
}

export const authCookie = (token: string) => `${AUTH_COOKIE_NAME}=${token}`;

// The token value from a response's Set-Cookie header, or null.
export function cookieTokenFrom(headers: Headers): string | null {
  const match = headers.get('set-cookie')?.match(new RegExp(`${AUTH_COOKIE_NAME}=([^;]*)`));
  return match?.[1] || null;
}

export type SignedInTeacher = {
  id: string;
  // Calls /api/v1/teacher<path> as this teacher.
  call: (method: string, path: string, body?: unknown) => Promise<ApiResponse>;
};

// A verified teacher with a live session. `prefix` makes the email easy to
// find and delete in `after()`.
export async function signedInTeacher(
  server: TestServer,
  prefix: string,
  name: string
): Promise<SignedInTeacher> {
  const row = await pool.query<{ id: string }>(
    `INSERT INTO teachers (full_name, email, email_verified)
     VALUES ($1, $2, TRUE) RETURNING id::text AS id`,
    [name, `${prefix}-${name.toLowerCase().replace(/\W+/g, '-')}-${Date.now()}@example.com`]
  );
  const id = row.rows[0]!.id;
  const { token } = await startTeacherSession(id, false);

  return {
    id,
    call: (method, path, body) =>
      server.request(method, `/teacher${path}`, { body, cookie: authCookie(token) }),
  };
}
