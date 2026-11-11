// Run with: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  NAME_LENGTH,
  PASSWORD_LENGTH,
  emailError,
  fullNameError,
  newPasswordError,
} from './authFormRules.ts';
import { waitForMinimumLoading } from './minimumDelay.ts';

describe('emailError', () => {
  it('accepts a normal address, even with spaces around it', () => {
    assert.equal(emailError('teacher@example.com'), undefined);
    assert.equal(emailError('  teacher@example.com  '), undefined);
  });

  it('asks for an email when empty or blank', () => {
    assert.equal(emailError(''), 'Email is required');
    assert.equal(emailError('   '), 'Email is required');
  });

  it('refuses what can’t be an address', () => {
    for (const email of [
      'teacher',
      'teacher@',
      '@example.com',
      'teacher@example',
      'a b@example.com',
    ]) {
      assert.equal(emailError(email), 'Enter a valid email', email);
    }
  });
});

describe('fullNameError', () => {
  it('accepts a normal name, including Arabic', () => {
    assert.equal(fullNameError('Omar Adel'), undefined);
    assert.equal(fullNameError('عمر عادل'), undefined);
  });

  it('applies the backend’s length limits, after trimming', () => {
    assert.equal(fullNameError('   '), 'Full name is required');
    assert.match(fullNameError(' A ')!, /at least 2/);
    assert.equal(fullNameError('x'.repeat(NAME_LENGTH.max)), undefined);
    assert.match(fullNameError('x'.repeat(NAME_LENGTH.max + 1))!, /100 characters or fewer/);
  });

  it('refuses digits, Western or Arabic', () => {
    assert.equal(fullNameError('Omar 2'), 'Full name cannot contain numbers');
    assert.equal(fullNameError('عمر ٢'), 'Full name cannot contain numbers');
  });
});

describe('newPasswordError', () => {
  it('matches the backend: 8 to 128 characters', () => {
    assert.equal(newPasswordError(''), 'Password is required');
    assert.match(newPasswordError('x'.repeat(PASSWORD_LENGTH.min - 1))!, /at least 8/);
    assert.equal(newPasswordError('x'.repeat(PASSWORD_LENGTH.min)), undefined);
    assert.equal(newPasswordError('x'.repeat(PASSWORD_LENGTH.max)), undefined);
    assert.match(newPasswordError('x'.repeat(PASSWORD_LENGTH.max + 1))!, /128 characters or fewer/);
  });
});

describe('waitForMinimumLoading', () => {
  it('waits out the rest of the minimum', async () => {
    const startedAt = Date.now();
    await waitForMinimumLoading(startedAt, 60);

    assert.ok(Date.now() - startedAt >= 55);
  });

  it('returns at once when the minimum has already passed', async () => {
    const before = Date.now();
    await waitForMinimumLoading(before - 1000, 60);

    assert.ok(Date.now() - before < 20);
  });
});
