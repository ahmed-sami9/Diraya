// Run with: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getSessionLabel } from './formatSession.ts';

describe('getSessionLabel (Egypt’s clock)', () => {
  // 23:30 on Thursday 5 Nov 2026 in Cairo (UTC+2 in winter); UTC is still 21:30.
  const NOW = new Date('2026-11-05T23:30:00+02:00');
  const at = (local: string) => new Date(`${local}+02:00`).toISOString();

  it('today, tomorrow and yesterday by Cairo’s calendar', () => {
    assert.deepEqual(getSessionLabel(at('2026-11-05T18:00:00'), NOW), {
      day: 'Today',
      time: '6:00 pm',
      isToday: true,
    });
    assert.equal(getSessionLabel(at('2026-11-06T16:00:00'), NOW).day, 'Tomorrow');
    assert.equal(getSessionLabel(at('2026-11-04T16:00:00'), NOW).day, 'Yesterday');
  });

  it('00:30 tomorrow in Cairo is tomorrow, though UTC says today', () => {
    const label = getSessionLabel(at('2026-11-06T00:30:00'), NOW);
    assert.equal(label.day, 'Tomorrow');
    assert.equal(label.time, '12:30 am');
  });

  it('further away: the short date', () => {
    assert.equal(getSessionLabel(at('2026-11-09T16:00:00'), NOW).day, 'Mon 9 Nov');
  });
});
