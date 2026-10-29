// Run with: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ActivityEntry } from '../api/activity/activity';
import { describeActivity, monthsLabel, timeAgo } from './activity.ts';

const entry = (type: string, details: object): ActivityEntry =>
  ({ id: '1', type, details, createdAt: '2026-10-28T10:00:00Z' }) as ActivityEntry;

describe('describeActivity: one sentence per type', () => {
  it('student.added', () => {
    assert.deepEqual(
      describeActivity(
        entry('student.added', {
          studentId: '7',
          studentName: 'Mariam Khaled',
          gradeName: 'Grade 1',
          groupName: 'Sat & Tue · 4 PM',
        })
      ),
      {
        kind: 'student',
        title: 'Added a student',
        detail: 'Mariam Khaled · Grade 1, Sat & Tue · 4 PM',
        to: '/teacher/students/7',
      }
    );
  });

  it('payment.recorded: money and the months it covered', () => {
    const described = describeActivity(
      entry('payment.recorded', {
        studentId: '7',
        studentName: 'Adam Mostafa',
        amount: 1050,
        months: ['2026-10', '2026-09'],
      })
    );

    assert.equal(described.detail, 'EGP 1,050 from Adam Mostafa · Sept & Oct');
    assert.equal(described.kind, 'payment');
  });

  it('payment.voided: with the reason', () => {
    assert.equal(
      describeActivity(
        entry('payment.voided', {
          studentId: '7',
          studentName: 'Nour Ibrahim',
          amount: 350,
          reason: 'Recorded twice by mistake',
        })
      ).detail,
      'EGP 350 from Nour Ibrahim · Recorded twice by mistake'
    );
  });

  it('attendance.taken: links to that class’s sheet', () => {
    const described = describeActivity(
      entry('attendance.taken', {
        groupId: '3',
        groupName: 'Sat & Tue · 4 PM',
        gradeName: 'Grade 1',
        day: '2026-10-27',
        present: 4,
        total: 5,
      })
    );

    assert.equal(described.detail, 'Sat & Tue · 4 PM · Grade 1 · 4 of 5 present');
    assert.equal(described.to, '/teacher/attendance?groupId=3&date=2026-10-27');
  });

  it('exam.added and marks.entered: link to the exam', () => {
    const exam = describeActivity(
      entry('exam.added', { examId: '9', title: 'Unit 3 test', gradeName: 'Grade 3', heldOn: '2026-11-02' })
    );
    const marks = describeActivity(
      entry('marks.entered', { examId: '9', title: 'Quiz 4', gradeName: 'Grade 1', entered: 8, total: 10 })
    );

    assert.equal(exam.detail, 'Unit 3 test · Grade 3 · Mon 2 Nov');
    assert.equal(marks.detail, 'Quiz 4 · Grade 1 · 8 of 10 entered');
    assert.equal(marks.to, '/teacher/exams/9');
  });

  it('a type this file doesn’t know yet: a plain entry, not a crash', () => {
    assert.deepEqual(describeActivity(entry('grade.renamed', { anything: true })), {
      kind: 'other',
      title: 'Updated your workspace',
      detail: '',
      to: null,
    });
  });
});

describe('monthsLabel', () => {
  it('one month by name, two with "&", more as a range, in order', () => {
    assert.equal(monthsLabel(['2026-10']), 'October');
    assert.equal(monthsLabel(['2026-10', '2026-09']), 'Sept & Oct');
    assert.equal(monthsLabel(['2026-11', '2026-09', '2026-10']), 'Sept – Nov');
  });
});

describe('timeAgo (Egypt’s clock)', () => {
  // 17:00 on Wednesday 28 Oct 2026 in Cairo (UTC+3).
  const NOW = new Date('2026-10-28T17:00:00+03:00');
  const at = (local: string) => new Date(`${local}+03:00`).toISOString();

  it('just now, minutes, then hours today', () => {
    assert.equal(timeAgo(at('2026-10-28T16:59:30'), NOW), 'Just now');
    assert.equal(timeAgo(at('2026-10-28T16:48:00'), NOW), '12 min ago');
    assert.equal(timeAgo(at('2026-10-28T14:00:00'), NOW), '3 h ago');
  });

  it('00:30 in Cairo is today, though UTC still says yesterday', () => {
    assert.equal(timeAgo(at('2026-10-28T00:30:00'), NOW), '16 h ago');
  });

  it('yesterday, then dates', () => {
    assert.equal(timeAgo(at('2026-10-27T20:00:00'), NOW), 'Yesterday');
    assert.equal(timeAgo(at('2026-10-26T09:00:00'), NOW), 'Mon 26 Oct');
    assert.equal(timeAgo(at('2025-09-12T09:00:00'), NOW), '12 Sept 2025');
  });
});
