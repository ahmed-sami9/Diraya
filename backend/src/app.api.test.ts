// Answers the app gives before any module runs: a body it can't read and an
// address that doesn't exist. Every one is JSON with a `code`, which is what
// the frontend's ApiError reads.

import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

import app from './app';
import { pool } from './config/db';
import { getFrontendOrigin } from './config/frontendOrigin';

let server: Server;
let baseUrl = '';

async function send(method: string, path: string, rawBody?: string): Promise<[number, any]> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      origin: getFrontendOrigin(),
      ...(rawBody === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: rawBody ?? null,
  });
  return [response.status, await response.json()];
}

before(() => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.close();
  await pool.end();
});

describe('GET /api/v1/health', () => {
  it('200 while the database answers, never cached, no sign-in needed', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
});

describe('requests the app refuses before any route', () => {
  it('broken JSON: 400 INVALID_JSON, not a 500', async () => {
    const [status, body] = await send('POST', '/api/v1/auth/login', '{"email": ');

    assert.equal(status, 400);
    assert.equal(body.code, 'INVALID_JSON');
  });

  it('a body over 100 KB: 413 PAYLOAD_TOO_LARGE, not a 500', async () => {
    const huge = JSON.stringify({ email: 'a'.repeat(200_000) });
    const [status, body] = await send('POST', '/api/v1/auth/login', huge);

    assert.equal(status, 413);
    assert.equal(body.code, 'PAYLOAD_TOO_LARGE');
  });

  it('an address that does not exist: a JSON 404', async () => {
    for (const path of ['/api/v1/nothing', '/api/v1/auth/nothing']) {
      const [status, body] = await send('GET', path);

      assert.equal(status, 404, path);
      assert.equal(body.code, 'NOT_FOUND', path);
    }
  });
});
