// /teacher/account through HTTP: auth, validation, ownership, and the password
// change's effect on sessions. Real database (diraya_test_db), real app.

import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

import app from '../../app';
import { pool } from '../../config/db';
import { getFrontendOrigin } from '../../config/frontendOrigin';
import { assertTestDatabase } from '../../test/assertTestDatabase';
import { AUTH_COOKIE_NAME } from '../auth/auth.cookie';
import { hashPassword, verifyPassword } from '../auth/password';
import { startTeacherSession } from '../auth/session/auth.session.service';

import { changePassword } from './account.repository';
import { PASSWORD_ATTEMPTS_LIMIT } from './account.routes';

const PASSWORD = 'old-password-1';

let server: Server;
let baseUrl = '';
const teacherIds: string[] = [];

type Call = (method: string, path: string, body?: unknown) => Promise<[number, any]>;

async function request(
  token: string | null,
  method: string,
  path: string,
  body?: unknown
): Promise<[number, any]> {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      origin: getFrontendOrigin(),
      ...(token ? { cookie: `${AUTH_COOKIE_NAME}=${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? null : JSON.stringify(body),
  });
  const text = await response.text();
  return [response.status, text ? JSON.parse(text) : null];
}

// A teacher with one signed-in session. `kind` decides how they sign in.
async function newTeacher(name: string, kind: 'password' | 'google' | 'demo' = 'password') {
  const email = `account-api-${name}-${Date.now()}@example.com`;
  const hash = kind === 'password' ? await hashPassword(PASSWORD) : null;

  const { id } = (
    await pool.query<{ id: string }>(
      `
        INSERT INTO teachers (full_name, email, password_hash, email_verified, is_demo)
        VALUES ($1, $2, $3, TRUE, $4)
        RETURNING id::text AS id
      `,
      [name, email, hash, kind === 'demo']
    )
  ).rows[0]!;
  teacherIds.push(id);

  const { token } = await startTeacherSession(id, false);
  const call: Call = (method, path, body) => request(token, method, path, body);

  return { id, email, token, call };
}

const storedHash = async (teacherId: string) =>
  (await pool.query('SELECT password_hash FROM teachers WHERE id = $1', [teacherId])).rows[0]
    .password_hash as string;

before(async () => {
  await assertTestDatabase();

  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.close();
  await pool.query('DELETE FROM teachers WHERE id = ANY ($1::bigint[])', [teacherIds]);
  await pool.end();
});

/* ---------------------------------- Guards -------------------------------- */

describe('guards', () => {
  it('no session: 401 on every endpoint', async () => {
    assert.equal((await request(null, 'GET', '/teacher/account'))[0], 401);
    assert.equal(
      (
        await request(null, 'PATCH', '/teacher/account/profile', { fullName: 'X Y', phone: null })
      )[0],
      401
    );
    assert.equal(
      (
        await request(null, 'POST', '/teacher/account/password', {
          currentPassword: PASSWORD,
          newPassword: 'new-password-1',
        })
      )[0],
      401
    );
  });
});

/* ----------------------------------- Read --------------------------------- */

describe('GET /teacher/account', () => {
  it('returns exactly the fields the page needs, and never the hash', async () => {
    const t = await newTeacher('Reader');
    const [status, body] = await t.call('GET', '/teacher/account');

    assert.equal(status, 200);
    assert.deepEqual(body, {
      account: { name: 'Reader', email: t.email, phone: null, hasPassword: true, isDemo: false },
    });
    assert.doesNotMatch(JSON.stringify(body), /hash|argon/i);
  });

  it('hasPassword and isDemo describe Google-only and demo teachers', async () => {
    const google = await newTeacher('Googler', 'google');
    const demo = await newTeacher('Demo', 'demo');

    assert.equal((await google.call('GET', '/teacher/account'))[1].account.hasPassword, false);

    const demoAccount = (await demo.call('GET', '/teacher/account'))[1].account;
    assert.equal(demoAccount.hasPassword, false);
    assert.equal(demoAccount.isDemo, true);
  });
});

/* ---------------------------------- Profile ------------------------------- */

describe('PATCH /teacher/account/profile', () => {
  it('saves the name (tidied) and phone, and answers with the fresh account', async () => {
    const t = await newTeacher('Before');
    const [status, body] = await t.call('PATCH', '/teacher/account/profile', {
      fullName: '  Ahmed    Sami ',
      phone: '01007168603',
    });

    assert.equal(status, 200);
    assert.equal(body.account.name, 'Ahmed Sami');
    assert.equal(body.account.phone, '01007168603');
    // /auth/me reads the same row, so the navbar shows the new name after a refresh.
    assert.equal((await t.call('GET', '/auth/me'))[1].user.name, 'Ahmed Sami');
  });

  it('phone: null clears it', async () => {
    const t = await newTeacher('Clearer');
    await t.call('PATCH', '/teacher/account/profile', {
      fullName: 'Clearer',
      phone: '01112345678',
    });

    const [, body] = await t.call('PATCH', '/teacher/account/profile', {
      fullName: 'Clearer',
      phone: null,
    });
    assert.equal(body.account.phone, null);
  });

  it('rejects a bad name, a bad phone, and any extra field like email', async () => {
    const t = await newTeacher('Strict');

    for (const bad of [
      { fullName: 'A', phone: null },
      { fullName: 'x'.repeat(101), phone: null },
      { fullName: 'Valid Name', phone: '010 1234 5678' },
      { fullName: 'Valid Name', phone: '01312345678' },
      { fullName: 'Valid Name', phone: null, email: 'stolen@example.com' },
    ]) {
      const [status, body] = await t.call('PATCH', '/teacher/account/profile', bad);
      assert.equal(status, 400, JSON.stringify(bad));
      assert.equal(body.code, 'INVALID_INPUT');
    }

    const account = (await t.call('GET', '/teacher/account'))[1].account;
    assert.equal(account.name, 'Strict');
    assert.equal(account.email.startsWith('account-api-Strict-'), true);
  });

  it('only ever changes the signed-in teacher', async () => {
    const a = await newTeacher('Owner');
    const b = await newTeacher('Bystander');

    await a.call('PATCH', '/teacher/account/profile', { fullName: 'Owner Two', phone: null });

    assert.equal((await b.call('GET', '/teacher/account'))[1].account.name, 'Bystander');
  });
});

/* --------------------------------- Password ------------------------------- */

describe('POST /teacher/account/password', () => {
  it('wrong current password: 400 (not 401) and nothing changes', async () => {
    const t = await newTeacher('Wrong');
    const before = await storedHash(t.id);

    const [status, body] = await t.call('POST', '/teacher/account/password', {
      currentPassword: 'not-my-password',
      newPassword: 'new-password-1',
    });

    assert.equal(status, 400);
    assert.equal(body.code, 'INVALID_CURRENT_PASSWORD');
    assert.equal(await storedHash(t.id), before);
    // Still signed in.
    assert.equal((await t.call('GET', '/teacher/account'))[0], 200);
  });

  it('rejects a too-short password, and one equal to the current', async () => {
    const t = await newTeacher('Rules');

    for (const newPassword of ['short', PASSWORD]) {
      const [status, body] = await t.call('POST', '/teacher/account/password', {
        currentPassword: PASSWORD,
        newPassword,
      });
      assert.equal(status, 400, newPassword);
      assert.equal(body.code, 'INVALID_INPUT');
    }
  });

  it('success: new password works, old fails, this session stays, the others end', async () => {
    const t = await newTeacher('Changer');
    const other = await startTeacherSession(t.id, true); // e.g. their phone
    const bystander = await newTeacher('Unrelated');

    // A pending reset link from before the change.
    await pool.query(
      `
        INSERT INTO password_reset_tokens (teacher_id, token_hash, expires_at)
        VALUES ($1, 'pending-link-hash', NOW() + INTERVAL '30 minutes')
      `,
      [t.id]
    );

    const [status] = await t.call('POST', '/teacher/account/password', {
      currentPassword: PASSWORD,
      newPassword: 'new-password-1',
    });
    assert.equal(status, 204);

    const hash = await storedHash(t.id);
    assert.equal(await verifyPassword('new-password-1', hash), true);
    assert.equal(await verifyPassword(PASSWORD, hash), false);

    // The session that made the change is kept...
    assert.equal((await t.call('GET', '/teacher/account'))[0], 200);
    // ...every other session of this teacher is signed out...
    const [otherStatus, otherBody] = await request(other.token, 'GET', '/teacher/account');
    assert.equal(otherStatus, 401);
    assert.equal(otherBody.code, 'SESSION_EXPIRED');
    // ...and nobody else is touched.
    assert.equal((await bystander.call('GET', '/teacher/account'))[0], 200);

    // The old reset link can no longer undo the change.
    const link = await pool.query(
      `SELECT used_at FROM password_reset_tokens WHERE token_hash = 'pending-link-hash'`
    );
    assert.notEqual(link.rows[0].used_at, null);

    // End to end: signing in uses the new password.
    const login = (password: string) =>
      request(null, 'POST', '/auth/login', { email: t.email, password });
    assert.equal((await login('new-password-1'))[0], 200);
    assert.equal((await login(PASSWORD))[0], 401);
  });

  it('Google-only teacher: 409 NO_PASSWORD; demo teacher: 403 DEMO_ACCOUNT', async () => {
    const google = await newTeacher('NoPass', 'google');
    const demo = await newTeacher('Visitor', 'demo');
    const body = { currentPassword: 'anything-1', newPassword: 'new-password-1' };

    const [googleStatus, googleBody] = await google.call('POST', '/teacher/account/password', body);
    assert.equal(googleStatus, 409);
    assert.equal(googleBody.code, 'NO_PASSWORD');

    const [demoStatus, demoBody] = await demo.call('POST', '/teacher/account/password', body);
    assert.equal(demoStatus, 403);
    assert.equal(demoBody.code, 'DEMO_ACCOUNT');
  });

  it(`stops guessing after ${PASSWORD_ATTEMPTS_LIMIT} failed attempts, per teacher`, async () => {
    const guessed = await newTeacher('Guessed');
    const neighbour = await newTeacher('Neighbour');
    const wrong = { currentPassword: 'guess-000', newPassword: 'new-password-1' };

    for (let attempt = 0; attempt < PASSWORD_ATTEMPTS_LIMIT; attempt++) {
      assert.equal((await guessed.call('POST', '/teacher/account/password', wrong))[0], 400);
    }

    const [status, body] = await guessed.call('POST', '/teacher/account/password', wrong);
    assert.equal(status, 429);
    assert.equal(body.code, 'TOO_MANY_ATTEMPTS');

    // Another teacher on the same network isn't locked out.
    assert.equal((await neighbour.call('POST', '/teacher/account/password', wrong))[0], 400);
  });
});

/* -------------------------- Repository: race guard ------------------------ */

describe('changePassword (repository)', () => {
  it('refuses when the hash changed since it was checked, and changes nothing', async () => {
    const t = await newTeacher('Racer');
    const current = await storedHash(t.id);
    const other = await startTeacherSession(t.id, false);

    const changed = await changePassword({
      teacherId: t.id,
      checkedHash: 'a-hash-from-before-another-change',
      newHash: await hashPassword('new-password-1'),
      keepSessionId: '00000000-0000-0000-0000-000000000000',
    });

    assert.equal(changed, false);
    assert.equal(await storedHash(t.id), current);
    // The rollback also kept every session.
    assert.equal((await request(other.token, 'GET', '/teacher/account'))[0], 200);
  });
});
