// The start-up settings check. Pure function: no database, no real env.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EnvError, parseEnv } from './env';

const developmentEnv = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/diraya_app_db',
  JWT_SECRET: 'a'.repeat(32),
};

const productionEnv = {
  NODE_ENV: 'production',
  PORT: '8080',
  DATABASE_URL: 'postgresql://user:pass@db.example.com:5432/diraya',
  JWT_SECRET: 'b'.repeat(48),
  FRONTEND_ORIGIN: 'https://diraya.example.com',
  GOOGLE_CLIENT_ID: 'google-id',
  GOOGLE_CLIENT_SECRET: 'google-secret',
  RESEND_API_KEY: 're_key',
  EMAIL_FROM: 'Diraya <no-reply@example.com>',
};

// The problems listed by the error, or a failure if nothing was thrown.
function problemsOf(env: Record<string, string | undefined>): string[] {
  try {
    parseEnv(env);
  } catch (error) {
    assert.ok(error instanceof EnvError);
    return error.problems;
  }
  assert.fail('expected the settings to be refused');
}

describe('parseEnv', () => {
  it('accepts a full production setup and converts the port to a number', () => {
    const env = parseEnv(productionEnv);

    assert.equal(env.NODE_ENV, 'production');
    assert.equal(env.PORT, 8080);
  });

  it('runs locally without Google, Resend or a frontend address', () => {
    const env = parseEnv(developmentEnv);

    assert.equal(env.FRONTEND_ORIGIN, undefined);
    assert.equal(env.RESEND_API_KEY, undefined);
  });

  it('defaults NODE_ENV to development', () => {
    const { NODE_ENV: _, ...withoutNodeEnv } = developmentEnv;

    assert.equal(parseEnv(withoutNodeEnv).NODE_ENV, 'development');
  });

  it('treats KEY= (empty) as not set', () => {
    const problems = problemsOf({ ...productionEnv, FRONTEND_ORIGIN: '', RESEND_API_KEY: '' });

    assert.deepEqual(problems, [
      'FRONTEND_ORIGIN is required in production',
      'RESEND_API_KEY is required in production',
    ]);
  });

  it('refuses production without a frontend address (no silent fallback)', () => {
    const { FRONTEND_ORIGIN: _, ...env } = productionEnv;

    assert.deepEqual(problemsOf(env), ['FRONTEND_ORIGIN is required in production']);
  });

  it('refuses a plain-http frontend address in production', () => {
    const problems = problemsOf({ ...productionEnv, FRONTEND_ORIGIN: 'http://diraya.example.com' });

    assert.deepEqual(problems, ['FRONTEND_ORIGIN must use https in production']);
  });

  it('refuses production without the email and Google settings', () => {
    const { RESEND_API_KEY, EMAIL_FROM, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ...env } =
      productionEnv;

    assert.deepEqual(problemsOf(env), [
      'GOOGLE_CLIENT_ID is required in production',
      'GOOGLE_CLIENT_SECRET is required in production',
      'RESEND_API_KEY is required in production',
      'EMAIL_FROM is required in production',
    ]);
  });

  it('refuses a short JWT secret', () => {
    const problems = problemsOf({ ...developmentEnv, JWT_SECRET: 'short' });

    assert.deepEqual(problems, ['JWT_SECRET must be at least 32 characters']);
  });

  it('refuses a missing or wrong database address', () => {
    const { DATABASE_URL: _, ...missing } = developmentEnv;

    assert.deepEqual(problemsOf(missing), ['DATABASE_URL is required']);
    assert.deepEqual(problemsOf({ ...developmentEnv, DATABASE_URL: 'mysql://x' }), [
      'DATABASE_URL must be a postgres:// connection string',
    ]);
  });

  it('refuses an invalid port and an unknown NODE_ENV', () => {
    assert.deepEqual(problemsOf({ ...developmentEnv, PORT: 'abc' }), ['PORT must be a port number']);
    assert.deepEqual(problemsOf({ ...developmentEnv, NODE_ENV: 'prod' }), [
      'NODE_ENV must be development, test or production',
    ]);
  });

  it('lists every problem at once', () => {
    const problems = problemsOf({ NODE_ENV: 'production', JWT_SECRET: 'short' });

    assert.equal(problems.length, 7);
    assert.ok(problems.includes('DATABASE_URL is required'));
    assert.ok(problems.includes('JWT_SECRET must be at least 32 characters'));
    assert.ok(problems.includes('FRONTEND_ORIGIN is required in production'));
  });

  it('never puts a value in the message, since values can be secrets', () => {
    const secret = 'leaked-secret-value';

    try {
      parseEnv({ ...productionEnv, JWT_SECRET: secret, DATABASE_URL: secret });
      assert.fail('expected the settings to be refused');
    } catch (error) {
      assert.ok(error instanceof EnvError);
      assert.ok(!error.message.includes(secret));
    }
  });
});
