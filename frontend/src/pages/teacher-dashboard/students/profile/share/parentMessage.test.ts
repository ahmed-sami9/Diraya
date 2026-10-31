// Run with: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { StudentProfile } from '../../../../../api/students/profile';

import { buildParentMessage } from './parentMessage.ts';

type Summary = StudentProfile['summary'];

const profileWith = (summary: Partial<Summary>): StudentProfile => ({
  id: '1',
  code: '26-0009',
  name: 'Karim Adel',
  grade: { id: '1', name: 'Grade 1 Secondary' },
  group: { id: '1', name: 'Sun & Wed', sessions: [] },
  parentPhone: '01178888889',
  phone: null,
  joinedAt: '2026-07-01T10:00:00.000Z',
  monthlyFee: 350,
  summary: {
    attendance: { rate: null, attended: 0, total: 0 },
    marks: { average: null, examCount: 0, changeSinceLastMonth: null },
    currentFee: null,
    lastSession: null,
    ...summary,
  },
});

const fee = (
  status: Summary['currentFee'] extends infer F ? NonNullable<F>['status'] : never,
  paid: number
) => ({
  month: '2026-10',
  amountDue: 350,
  amountPaid: paid,
  status,
  skipReason: null,
  lastPaidAt: null,
});

const full = profileWith({
  attendance: { rate: 79, attended: 22, total: 28 },
  marks: { average: 66, examCount: 5, changeSinceLastMonth: -2 },
  currentFee: fee('partly', 175),
  lastSession: {
    sessionId: '1',
    // 00:30 on Thu 29 Oct in Cairo; UTC still says Wed 28.
    heldAt: '2026-10-28T22:30:00.000Z',
    status: 'present',
    groupName: 'Sun & Wed',
    isMakeUp: false,
    reason: null,
  },
});

describe('buildParentMessage', () => {
  it('a student with everything: greeting, the four numbers, a sign-off', () => {
    assert.equal(
      buildParentMessage(full, 'Ahmed Samy'),
      [
        'Hello! This is Ahmed Samy, Karim’s teacher. Here is a quick update on Karim Adel:',
        '',
        '*Attendance:* 79% (22 of 28 sessions)',
        '*Average mark:* 66% across 5 exams, down 2 points from last month',
        '*October fee:* Partly paid, 175 of 350 EGP',
        '*Last session:* Present on Thu 29 Oct',
        '',
        'Feel free to reply here with any questions.',
      ].join('\n')
    );
  });

  it('leaves out what has no data yet', () => {
    const message = buildParentMessage(
      profileWith({ attendance: { rate: 100, attended: 2, total: 2 } }),
      'Ahmed'
    );

    assert.match(message, /\*Attendance:\* 100% \(2 of 2 sessions\)/);
    assert.doesNotMatch(message, /Average mark|fee:|Last session/);
  });

  it('a brand-new student still gets a polite message', () => {
    assert.match(buildParentMessage(profileWith({}), 'Ahmed'), /Nothing has been recorded yet/);
  });

  it('one exam, and no trend when nothing changed', () => {
    const message = buildParentMessage(
      profileWith({ marks: { average: 80, examCount: 1, changeSinceLastMonth: 0 } }),
      'Ahmed'
    );

    assert.match(
      message,
      /\*Average mark:\* 80% across 1 exam\n|\*Average mark:\* 80% across 1 exam$/m
    );
    assert.doesNotMatch(message, /points/);
  });

  it('says each fee status in plain words', () => {
    const line = (status: Parameters<typeof fee>[0], paid: number) =>
      buildParentMessage(profileWith({ currentFee: fee(status, paid) }), 'A').match(
        /\*October fee:\* (.*)/
      )?.[1];

    assert.equal(line('paid', 350), 'Paid (350 EGP)');
    assert.equal(line('unpaid', 0), 'Not paid yet (350 EGP)');
    assert.equal(line('skipped', 0), 'Skipped this month');
    assert.equal(line('not-due', 0), 'Nothing due');
  });
});
