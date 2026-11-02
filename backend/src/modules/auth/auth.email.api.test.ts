// One account per email, whatever the capitals: sign-up and sign-in both
// lower-case the email, and the database refuses a stored capital.
// Real database (diraya_test_db), real app.

import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

import app from '../../app';
import { pool } from '../../config/db';
import { getFrontendOrigin } from '../../config/frontendOrigin';
import { assertTestDatabase } from '../../test/assertTestDatabase';

import { hashPassword } from './password';

let server: Server;
let baseUrl = '';
const run = Date.now();
const emailFor = (name: string) => `auth-email-${name}-${run}@example.com`;

async function post(path: string, body: unknown): Promise<[number, any]> {
  const response = await fetch(`${baseUrl}/api/v1/auth${path}`, {
    method: 'POST',
    headers: { origin: getFrontendOrigin(), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return [response.status, text ? JSON.parse(text) : null];
}

const teachersWith = async (email: string) =>
  (
    await pool.query<{ email: string }>('SELECT email FROM teachers WHERE lower(email) = $1', [
      email.toLowerCase(),
    ])
  ).rows;

before(async () => {
  await assertTestDatabase();
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.close();
  await pool.query("DELETE FROM teachers WHERE email LIKE 'auth-email-%'");
  await pool.end();
});

describe('emails ignore capitals', () => {
  it('sign-up stores the email in lower case', async () => {
    const email = emailFor('stored');
    const [status, body] = await post('/signup', {
      fullName: 'Stored Case',
      email: email.toUpperCase(),
      password: 'password123',
    });

    assert.equal(status, 201);
    assert.equal(body.email, email);
    assert.deepEqual(await teachersWith(email), [{ email }]);
  });

  it('signing up again with other capitals reuses the one account', async () => {
    const email = emailFor('twice');
    await post('/signup', { fullName: 'First', email, password: 'password123' });
    await post('/signup', {
      fullName: 'Second',
      email: email.replace('twice', 'TWICE'),
      password: 'password123',
    });

    assert.equal((await teachersWith(email)).length, 1);
  });

  it('a verified email with other capitals is taken: 409', async () => {
    const email = emailFor('taken');
    await pool.query(
      `INSERT INTO teachers (full_name, email, email_verified) VALUES ('Taken', $1, TRUE)`,
      [email]
    );

    const [status, body] = await post('/signup', {
      fullName: 'Copycat',
      email: email.replace('taken', 'Taken'),
      password: 'password123',
    });

    assert.equal(status, 409);
    assert.equal(body.code, 'EMAIL_TAKEN');
  });

  it('sign-in works whatever capitals the teacher types', async () => {
    const email = emailFor('login');
    await pool.query(
      `INSERT INTO teachers (full_name, email, password_hash, email_verified)
       VALUES ('Login Case', $1, $2, TRUE)`,
      [email, await hashPassword('password123')]
    );

    const [status, body] = await post('/login', {
      email: `  ${email.toUpperCase()} `,
      password: 'password123',
    });

    assert.equal(status, 200);
    assert.equal(body.user.email, email);
  });

  it('the database refuses an email with capitals', async () => {
    await assert.rejects(
      pool.query(`INSERT INTO teachers (full_name, email) VALUES ('Raw', $1)`, [
        emailFor('Raw'),
      ]),
      { constraint: 'teachers_email_lowercase' }
    );
  });

  it('bad sign-up data answers with a code, like every other module', async () => {
    const [status, body] = await post('/signup', { fullName: 'X', email: 'nope', password: '1' });

    assert.equal(status, 400);
    assert.equal(body.code, 'INVALID_INPUT');
  });
});
