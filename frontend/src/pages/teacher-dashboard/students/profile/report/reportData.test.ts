// Run with: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  AttendanceRecord,
  ExamResult,
  PaymentMonth,
  StudentProfile,
} from '../../../../../api/students/profile';

import { buildStudentReport, reportFileName, reportMonths } from './reportData.ts';

const profile = {
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
  },
} satisfies StudentProfile;

const session = (heldAt: string, status: AttendanceRecord['status']): AttendanceRecord => ({
  sessionId: heldAt,
  heldAt,
  status,
  groupName: 'Sun & Wed',
  isMakeUp: false,
  reason: null,
});

const exam = (
  heldAt: string,
  status: ExamResult['status'],
  score: number | null,
  maxScore = 20
): ExamResult => ({
  examId: heldAt,
  title: `Quiz ${heldAt.slice(5, 10)}`,
  kind: 'quiz',
  heldAt,
  status,
  score,
  maxScore,
});

const month = (
  m: string,
  due: number,
  paid: number,
  status: PaymentMonth['status']
): PaymentMonth => ({
  month: m,
  amountDue: due,
  amountPaid: paid,
  status,
  skipReason: null,
  lastPaidAt: null,
});

const build = (input: Partial<Parameters<typeof buildStudentReport>[0]>) =>
  buildStudentReport(
    { profile, attendance: [], exams: [], payments: [], ...input },
    { teacherName: 'Ahmed Samy', currentMonth: '2026-10', now: new Date('2026-10-31T10:00:00Z') }
  );

describe('the 3-month window', () => {
  it('ends with this month, oldest first', () => {
    assert.deepEqual(reportMonths('2026-10'), ['2026-08', '2026-09', '2026-10']);
  });

  it('crosses New Year', () => {
    assert.deepEqual(reportMonths('2027-01'), ['2026-11', '2026-12', '2027-01']);
  });

  it('labels the period, with the year once when it is the same', () => {
    assert.equal(build({}).period.label, 'August – October 2026');
  });
});

describe('attendance', () => {
  const report = build({
    attendance: [
      // 00:30 on 1 Sep in Cairo: September, though UTC still says August.
      session('2026-08-31T21:30:00.000Z', 'absent'),
      session('2026-09-06T15:00:00.000Z', 'present'),
      session('2026-09-09T15:00:00.000Z', 'late'),
      session('2026-09-13T15:00:00.000Z', 'excused'),
      session('2026-10-04T15:00:00.000Z', 'present'),
      // Before the window: left out.
      session('2026-07-15T15:00:00.000Z', 'absent'),
    ],
  });

  it('one row per month in Egypt’s calendar, an empty month too', () => {
    assert.deepEqual(
      report.attendance.rows.map((row) => [
        row.month,
        row.present,
        row.late,
        row.absent,
        row.excused,
        row.rate,
      ]),
      [
        ['2026-08', 0, 0, 0, 0, null],
        ['2026-09', 1, 1, 1, 1, 67],
        ['2026-10', 1, 0, 0, 0, 100],
      ]
    );
    assert.deepEqual(report.attendance.rows[1]!.absences, ['Tue 1 Sept']);
  });

  it('the period rate: late counts as came, excused counts for nothing', () => {
    assert.deepEqual(
      [report.attendance.attended, report.attendance.total, report.attendance.rate],
      [3, 4, 75]
    );
  });
});

describe('exams', () => {
  const report = build({
    exams: [
      exam('2026-10-21T09:00:00.000Z', 'scored', 18),
      exam('2026-09-25T09:00:00.000Z', 'absent', null),
      exam('2026-09-20T09:00:00.000Z', 'not-entered', null),
      exam('2026-08-10T09:00:00.000Z', 'scored', 6, 10),
      exam('2026-07-10T09:00:00.000Z', 'scored', 0),
    ],
  });

  it('lists the window’s exams, newest first, with their percent', () => {
    assert.deepEqual(
      report.exams.rows.map((row) => [row.day, row.status, row.percent]),
      [
        ['Wed 21 Oct', 'scored', 90],
        ['Fri 25 Sept', 'absent', null],
        ['Sun 20 Sept', 'not-entered', null],
        ['Mon 10 Aug', 'scored', 60],
      ]
    );
  });

  it('averages real marks only: (90 + 60) / 2', () => {
    assert.equal(report.exams.average, 75);
  });

  it('no marks in the window: null, not 0', () => {
    assert.equal(
      build({ exams: [exam('2026-10-21T09:00:00.000Z', 'absent', null)] }).exams.average,
      null
    );
  });
});

describe('fees', () => {
  const report = build({
    payments: [
      month('2026-11', 350, 350, 'paid'),
      month('2026-10', 350, 175, 'partly'),
      month('2026-09', 0, 0, 'skipped'),
      month('2026-08', 350, 0, 'unpaid'),
      month('2026-07', 350, 0, 'unpaid'),
    ],
  });

  it('the window’s months only: nothing paid ahead, nothing older', () => {
    assert.deepEqual(
      report.fees.rows.map((row) => row.month),
      ['2026-10', '2026-09', '2026-08']
    );
  });

  it('owed: what is left in those months', () => {
    assert.equal(report.fees.owed, 175 + 350);
  });
});

describe('privacy', () => {
  it('never carries the teacher’s notes, even when handed the whole profile', () => {
    const everything = {
      profile,
      attendance: [],
      exams: [],
      payments: [],
      notes: [{ id: '1', text: 'SECRET: talk to the father', createdAt: '2026-10-01T10:00:00Z' }],
    };
    const report = buildStudentReport(everything, { teacherName: 'A', currentMonth: '2026-10' });

    assert.doesNotMatch(JSON.stringify(report), /SECRET/);
  });
});

describe('reportFileName', () => {
  it('the student and the period, safe for any computer', () => {
    assert.equal(reportFileName(build({})), 'Karim-Adel-report-Aug-Oct-2026.pdf');
  });
});
