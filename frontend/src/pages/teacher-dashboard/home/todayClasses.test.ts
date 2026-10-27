// Run with: npm test (Node's built-in runner, no extra packages).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TodayClass } from '../../../api/home/home';
import { attendanceLink, todayProgress } from './todayClasses.ts';

const lesson = (groupId: string, startTime: string, taken: boolean): TodayClass => ({
  groupId,
  groupName: `Group ${groupId}`,
  gradeId: '1',
  gradeName: 'Grade 1',
  startTime,
  taken,
});

describe('todayProgress', () => {
  it('no classes today: nothing to take', () => {
    assert.deepEqual(todayProgress([]), { total: 0, taken: 0, next: null });
  });

  it('none taken yet: the earliest class is next', () => {
    const classes = [lesson('1', '16:00', false), lesson('2', '18:00', false)];

    const progress = todayProgress(classes);

    assert.equal(progress.taken, 0);
    assert.equal(progress.next?.groupId, '1');
  });

  it('skips classes already taken, even earlier ones', () => {
    const classes = [
      lesson('1', '14:00', true),
      lesson('2', '16:00', false),
      lesson('3', '18:00', false),
    ];

    const progress = todayProgress(classes);

    assert.equal(progress.taken, 1);
    assert.equal(progress.next?.groupId, '2');
  });

  it('a forgotten class comes before a later one that was taken', () => {
    const classes = [lesson('1', '14:00', false), lesson('2', '16:00', true)];

    assert.equal(todayProgress(classes).next?.groupId, '1');
  });

  it('all taken: no next class', () => {
    const classes = [lesson('1', '16:00', true), lesson('2', '18:00', true)];

    assert.deepEqual(todayProgress(classes), { total: 2, taken: 2, next: null });
  });
});

describe('attendanceLink', () => {
  it('opens that group on that day', () => {
    assert.equal(attendanceLink('6', '2026-10-27'), '/teacher/attendance?groupId=6&date=2026-10-27');
  });
});
