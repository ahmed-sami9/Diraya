// API tests for /api/v1/auth: sign-up and email confirmation, sign-in,
// sessions, sign-out, the demo, and password reset. Real database
// (diraya_test_db), real app.
//
// Emails are never sent here: without RESEND_API_KEY the backend prints them,
// and the tests read the link from that output, then use it like a teacher
// clicking it in their inbox.

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';

import { pool } from '../../config/db';
import { assertTestDatabase } from '../../test/assertTestDatabase';
import { authCookie, cookieTokenFrom, startTestServer, type TestServer } from '../../test/api';

import { hashPassword } from './password';
import { requestPasswordReset } from './password-reset/auth.passwordReset.service';

const PREFIX = 'auth-api';
const run = Date.now();
const emailFor = (name: string) => `${PREFIX}-${name}-${run}@example.com`;
const PASSWORD = 'correct-horse-1';

let server: TestServer;
const post = (path: string, body: unknown) => server.request('POST', `/auth${path}`, { body });
const me = (token: string) => server.request('GET', '/auth/me', { cookie: authCookie(token) });

/* ------------------------------ Printed emails ----------------------------- */

const printed: string[] = [];
const realLog = console.log;

// The token from the newest email printed for `to`. Some endpoints answer
// before sending (so the answer can't reveal anything), hence the short wait.
async function tokenFromEmailTo(to: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const email = printed.findLast((text) => text.includes(`To:      ${to}`));
    const token = email?.match(/token=([\w-]+)/)?.[1];
    if (token) return token;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`No email was printed for ${to}`);
}

const emailsTo = (to: string) => printed.filter((text) => text.includes(`To:      ${to}`)).length;

// Waits up to a second for `count` emails to `to`, for emails sent after the answer.
async function waitForEmails(to: string, count: number): Promise<void> {
  for (let attempt = 0; attempt < 50 && emailsTo(to) < count; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/* ---------------------------------- Setup ---------------------------------- */

// A verified teacher with a password, straight into the database.
async function teacherWithPassword(name: string, options: { verified?: boolean } = {}) {
  const email = emailFor(name);
  const row = await pool.query<{ id: string }>(
    `INSERT INTO teachers (full_name, email, password_hash, email_verified)
     VALUES ($1, $2, $3, $4) RETURNING id::text AS id`,
    [name, email, await hashPassword(PASSWORD), options.verified ?? true]
  );
  return { id: row.rows[0]!.id, email };
}

async function signIn(email: string, password = PASSWORD, rememberMe = false) {
  const response = await post('/login', { email, password, rememberMe });
  return { ...response, token: cookieTokenFrom(response.headers) };
}

before(async () => {
  await assertTestDatabase();
  // Never send a real email from a test, whatever the environment holds.
  delete process.env.RESEND_API_KEY;
  server = startTestServer();
  console.log = (...args: unknown[]) => {
    printed.push(args.map(String).join(' '));
  };
});

after(async () => {
  console.log = realLog;
  server.close();
  await pool.query(`DELETE FROM teachers WHERE email LIKE '${PREFIX}-%'`);
  await pool.end();
});

/* ------------------------------ Sign-up flow ------------------------------ */

describe('sign-up and email confirmation', () => {
  it('creates an unconfirmed account, with no session, and emails a link', async () => {
    const email = emailFor('signup');
    const { status, body, headers } = await post('/signup', {
      fullName: 'New Teacher',
      email,
      password: PASSWORD,
    });

    assert.equal(status, 201);
    assert.deepEqual(body.requiresVerification, true);
    assert.equal(cookieTokenFrom(headers), null);

    const row = await pool.query(
      'SELECT email_verified, password_hash FROM teachers WHERE email = $1',
      [email]
    );
    assert.equal(row.rows[0].email_verified, false);
    // Stored as an argon2 hash, never as typed.
    assert.match(row.rows[0].password_hash, /^\$argon2/);
    assert.ok(await tokenFromEmailTo(email));
  });

  it('can’t sign in before confirming; a wrong password still gets the generic answer', async () => {
    const email = emailFor('unconfirmed');
    await post('/signup', { fullName: 'Unconfirmed', email, password: PASSWORD });

    const right = await signIn(email);
    const wrong = await signIn(email, 'wrong-password');

    assert.equal(right.status, 403);
    assert.equal(right.body.code, 'EMAIL_NOT_VERIFIED');
    assert.equal(right.token, null);
    // Without the right password, nobody learns the account is waiting.
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.code, 'INVALID_CREDENTIALS');
  });

  it('the emailed link confirms the account and signs the teacher in', async () => {
    const email = emailFor('confirm');
    await post('/signup', { fullName: 'Confirm Me', email, password: PASSWORD });
    const token = await tokenFromEmailTo(email);

    const { status, body, headers } = await post('/email/verify', { token });

    assert.equal(status, 200);
    assert.equal(body.user.email, email);
    const session = cookieTokenFrom(headers);
    assert.ok(session);
    assert.equal((await me(session!)).status, 200);
    assert.equal((await signIn(email)).status, 200);
  });

  it('a confirmation link works once', async () => {
    const email = emailFor('once');
    await post('/signup', { fullName: 'Once', email, password: PASSWORD });
    const token = await tokenFromEmailTo(email);
    await post('/email/verify', { token });

    const again = await post('/email/verify', { token });

    assert.equal(again.status, 400);
    assert.equal(again.body.code, 'INVALID_VERIFICATION_TOKEN');
  });

  it('a made-up or expired link is refused', async () => {
    const email = emailFor('expired-link');
    await post('/signup', { fullName: 'Expired', email, password: PASSWORD });
    const token = await tokenFromEmailTo(email);
    await pool.query(
      `UPDATE email_verification_tokens SET expires_at = NOW() - INTERVAL '1 minute'
       WHERE teacher_id = (SELECT id FROM teachers WHERE email = $1)`,
      [email]
    );

    const expired = await post('/email/verify', { token });
    const madeUp = await post('/email/verify', { token: 'x'.repeat(43) });

    assert.equal(expired.body.code, 'INVALID_VERIFICATION_TOKEN');
    assert.equal(madeUp.body.code, 'INVALID_VERIFICATION_TOKEN');
  });

  it('asking for a new link answers the same whether or not the account exists', async () => {
    const waiting = emailFor('resend');
    await post('/signup', { fullName: 'Resend', email: waiting, password: PASSWORD });
    await pool.query(
      `UPDATE email_verification_tokens SET created_at = NOW() - INTERVAL '2 minutes'
       WHERE teacher_id = (SELECT id FROM teachers WHERE email = $1)`,
      [waiting]
    );

    const known = await post('/email/verification/resend', { email: waiting });
    const unknown = await post('/email/verification/resend', { email: emailFor('nobody') });

    assert.equal(known.status, 200);
    assert.deepEqual(known.body, unknown.body);
    // Sign-up's email, then the new one, sent in the background.
    await waitForEmails(waiting, 2);
    assert.equal(emailsTo(waiting), 2);
    assert.equal(emailsTo(emailFor('nobody')), 0);
  });
});

/* --------------------------------- Sign-in -------------------------------- */

describe('sign-in', () => {
  it('a wrong password and an unknown email get the same answer', async () => {
    const { email } = await teacherWithPassword('generic');

    const wrongPassword = await signIn(email, 'wrong-password');
    const unknownEmail = await signIn(emailFor('ghost'));

    assert.equal(wrongPassword.status, 401);
    assert.deepEqual(wrongPassword.body, unknownEmail.body);
  });

  it('a Google-only teacher (no password) can’t sign in with a password', async () => {
    const email = emailFor('google-only');
    await pool.query(
      `INSERT INTO teachers (full_name, email, google_id, email_verified)
       VALUES ('Google Only', $1, $2, TRUE)`,
      [email, `google-${run}`]
    );

    const { status, body } = await signIn(email, 'anything-at-all');

    assert.equal(status, 401);
    assert.equal(body.code, 'INVALID_CREDENTIALS');
  });

  it('sets an httpOnly, SameSite=Lax cookie that ends with the browser by default', async () => {
    const { email } = await teacherWithPassword('cookie');

    const { status, body, headers } = await signIn(email);
    const cookie = headers.get('set-cookie') ?? '';

    assert.equal(status, 200);
    assert.deepEqual(Object.keys(body.user).sort(), ['email', 'id', 'name', 'role']);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.doesNotMatch(cookie, /Max-Age/i);
  });

  it('"remember me" keeps the cookie for 7 days', async () => {
    const { email } = await teacherWithPassword('remember');

    const { headers } = await signIn(email, PASSWORD, true);
    const maxAge = Number(headers.get('set-cookie')?.match(/Max-Age=(\d+)/i)?.[1]);

    assert.ok(Math.abs(maxAge - 7 * 24 * 60 * 60) < 60, `Max-Age was ${maxAge}`);
  });

  it('refuses a request from another website (CSRF check)', async () => {
    const { email } = await teacherWithPassword('csrf');

    const { status, body } = await server.request('POST', '/auth/login', {
      body: { email, password: PASSWORD },
      origin: 'https://evil.example.com',
    });

    assert.equal(status, 403);
    assert.equal(body.code, 'UNTRUSTED_ORIGIN');
  });

  it('Google sign-in without a code is refused before reaching Google', async () => {
    const { status, body } = await post('/google', { code: '' });

    assert.equal(status, 400);
    assert.equal(body.code, 'INVALID_INPUT');
  });
});

/* -------------------------------- Sessions -------------------------------- */

describe('sessions', () => {
  let teacher: { id: string; email: string };
  let token: string;

  beforeEach(async () => {
    teacher ??= await teacherWithPassword('sessions');
    token = (await signIn(teacher.email)).token!;
  });

  const sessionOf = (sessionToken: string) => (jwt.decode(sessionToken) as { sid: string }).sid;

  it('a live session reaches /me', async () => {
    const { status, body } = await me(token);

    assert.equal(status, 200);
    assert.equal(body.user.email, teacher.email);
  });

  it('no cookie, a garbage cookie, or a token signed with another key: 401', async () => {
    const forged = jwt.sign(
      { userId: teacher.id, role: 'teacher', sid: sessionOf(token) },
      'not-the-real-secret-not-the-real-secret',
      { issuer: 'diraya', audience: 'diraya-api', expiresIn: '1h' }
    );

    assert.equal((await server.request('GET', '/auth/me')).body.code, 'AUTHENTICATION_REQUIRED');
    assert.equal((await me('garbage')).body.code, 'INVALID_TOKEN');
    assert.equal((await me(forged)).body.code, 'INVALID_TOKEN');
  });

  it('a session idle for more than 3 hours has ended', async () => {
    await pool.query(
      `UPDATE teacher_sessions SET last_activity_at = NOW() - INTERVAL '3 hours 1 minute'
       WHERE id = $1`,
      [sessionOf(token)]
    );

    const { status, body } = await me(token);

    assert.equal(status, 401);
    assert.equal(body.code, 'SESSION_EXPIRED');
  });

  it('a "remember me" session survives being idle', async () => {
    const remembered = (await signIn(teacher.email, PASSWORD, true)).token!;
    await pool.query(
      `UPDATE teacher_sessions SET last_activity_at = NOW() - INTERVAL '2 days' WHERE id = $1`,
      [sessionOf(remembered)]
    );

    assert.equal((await me(remembered)).status, 200);
  });

  it('a session past its end date has ended, even with a valid token', async () => {
    await pool.query(
      `UPDATE teacher_sessions SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`,
      [sessionOf(token)]
    );

    assert.equal((await me(token)).body.code, 'SESSION_EXPIRED');
  });

  it('signing out ends the session on the server, not just in the browser', async () => {
    const response = await server.request('POST', '/auth/logout', { cookie: authCookie(token) });

    assert.equal(response.status, 200);
    // The browser is told to drop the cookie...
    assert.match(response.headers.get('set-cookie') ?? '', /accessToken=;/);
    // ...and a copy of the old cookie no longer works.
    assert.equal((await me(token)).body.code, 'SESSION_EXPIRED');
  });

  it('signing out ends only that session, not the teacher’s other devices', async () => {
    const otherDevice = (await signIn(teacher.email)).token!;

    await server.request('POST', '/auth/logout', { cookie: authCookie(token) });

    assert.equal((await me(otherDevice)).status, 200);
  });

  it('signing out without a session still answers 200', async () => {
    assert.equal((await server.request('POST', '/auth/logout')).status, 200);
  });
});

/* ---------------------------------- Demo ---------------------------------- */

describe('demo', () => {
  it('creates a separate, filled-in teacher for each visitor', async () => {
    const first = await post('/demo', {});
    const second = await post('/demo', {});

    assert.equal(first.status, 201);
    assert.equal(first.body.user.isDemo, true);
    assert.match(first.body.user.email, /@demo\.diraya\.invalid$/);
    assert.notEqual(first.body.user.id, second.body.user.id);

    const grades = await server.request('GET', '/teacher/grades', {
      cookie: authCookie(cookieTokenFrom(first.headers)!),
    });
    assert.equal(grades.status, 200);
    assert.ok(grades.body.grades.length > 0, 'the demo should start with sample data');

    for (const demo of [first, second]) {
      await server.request('POST', '/auth/logout', {
        cookie: authCookie(cookieTokenFrom(demo.headers)!),
      });
    }
  });

  it('signing out of a demo deletes it and everything in it', async () => {
    const demo = await post('/demo', {});
    const id = demo.body.user.id;

    await server.request('POST', '/auth/logout', {
      cookie: authCookie(cookieTokenFrom(demo.headers)!),
    });

    assert.equal((await pool.query('SELECT 1 FROM teachers WHERE id = $1', [id])).rows.length, 0);
    assert.equal(
      (await pool.query('SELECT 1 FROM students WHERE teacher_id = $1', [id])).rows.length,
      0
    );
  });

  it('demos older than a day are removed when the next one starts', async () => {
    const old = await post('/demo', {});
    await pool.query(`UPDATE teachers SET created_at = NOW() - INTERVAL '25 hours' WHERE id = $1`, [
      old.body.user.id,
    ]);

    const fresh = await post('/demo', {});

    const left = await pool.query('SELECT 1 FROM teachers WHERE id = $1', [old.body.user.id]);
    assert.equal(left.rows.length, 0);
    await server.request('POST', '/auth/logout', {
      cookie: authCookie(cookieTokenFrom(fresh.headers)!),
    });
  });

  it('signing out of a real account never deletes it', async () => {
    const { id, email } = await teacherWithPassword('not-a-demo');
    const { token } = await signIn(email);

    await server.request('POST', '/auth/logout', { cookie: authCookie(token!) });

    assert.equal((await pool.query('SELECT 1 FROM teachers WHERE id = $1', [id])).rows.length, 1);
  });
});

/* ----------------------------- Password reset ----------------------------- */

// The email limiter allows 5 requests per 15 minutes, shared with "resend the
// confirmation link". Only the tests about the endpoint itself call it; the
// others ask the service for a link directly (same token, same email).
describe('password reset', () => {
  it('answers the same for an unknown email, and sends nothing', async () => {
    const { email } = await teacherWithPassword('reset-known');

    const known = await post('/password/forgot', { email });
    const unknown = await post('/password/forgot', { email: emailFor('reset-nobody') });

    assert.equal(known.status, 200);
    assert.deepEqual(known.body, unknown.body);
    await tokenFromEmailTo(email);
    assert.equal(emailsTo(emailFor('reset-nobody')), 0);
  });

  it('the emailed link sets a new password and signs out every device', async () => {
    const { id, email } = await teacherWithPassword('reset-flow', { verified: false });
    const phone = (await signIn(email)).token; // unverified: no session
    assert.equal(phone, null);
    await pool.query('UPDATE teachers SET email_verified = TRUE WHERE id = $1', [id]);
    const laptop = (await signIn(email)).token!;

    await post('/password/forgot', { email });
    const token = await tokenFromEmailTo(email);

    assert.deepEqual((await post('/password/reset/verify', { token })).body, { valid: true });

    const reset = await post('/password/reset', { token, password: 'brand-new-pass' });

    assert.equal(reset.status, 200);
    assert.equal((await me(laptop)).body.code, 'SESSION_EXPIRED');
    assert.equal((await signIn(email)).status, 401);
    assert.equal((await signIn(email, 'brand-new-pass')).status, 200);
  });

  it('resetting also confirms the email: the link proves the inbox is theirs', async () => {
    const { id, email } = await teacherWithPassword('reset-confirms', { verified: false });

    await requestPasswordReset(email);
    await post('/password/reset', {
      token: await tokenFromEmailTo(email),
      password: 'brand-new-pass',
    });

    const row = await pool.query('SELECT email_verified FROM teachers WHERE id = $1', [id]);
    assert.equal(row.rows[0].email_verified, true);
  });

  it('a reset link works once, and an expired one not at all', async () => {
    const used = await teacherWithPassword('reset-once');
    await requestPasswordReset(used.email);
    const usedToken = await tokenFromEmailTo(used.email);
    await post('/password/reset', { token: usedToken, password: 'brand-new-pass' });

    const expired = await teacherWithPassword('reset-expired');
    await requestPasswordReset(expired.email);
    const expiredToken = await tokenFromEmailTo(expired.email);
    await pool.query(
      `UPDATE password_reset_tokens SET expires_at = NOW() - INTERVAL '1 minute' WHERE teacher_id = $1`,
      [expired.id]
    );

    for (const token of [usedToken, expiredToken]) {
      assert.deepEqual((await post('/password/reset/verify', { token })).body, { valid: false });
      const reset = await post('/password/reset', { token, password: 'another-pass-1' });
      assert.equal(reset.status, 400);
      assert.equal(reset.body.code, 'INVALID_RESET_TOKEN');
    }
    // The expired link changed nothing.
    assert.equal((await signIn(expired.email)).status, 200);
  });

  it('too many email requests in a row are refused', async () => {
    // 2 resend + 3 forgot requests above: the next one is over the limit.
    let last = await post('/password/forgot', { email: emailFor('limit') });
    for (let i = 0; i < 5 && last.status === 200; i += 1) {
      last = await post('/password/forgot', { email: emailFor('limit') });
    }

    assert.equal(last.status, 429);
    assert.equal(last.body.code, 'TOO_MANY_ATTEMPTS');
  });
});
