// The profile's marks and fees, and the grade table's two columns, through
// the real app and database (diraya_test_db). They reuse the exams and
// payments SQL, so these tests also check the pages agree with each other.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

import app from '../../../app';
import { pool } from '../../../config/db';
import { getFrontendOrigin } from '../../../config/frontendOrigin';
import { assertTestDatabase } from '../../../test/assertTestDatabase';
import { currentMonthInCairo, todayInCairo } from '../../../utils/cairoDate';
import { AUTH_COOKIE_NAME } from '../../auth/auth.cookie';
import { startTeacherSession } from '../../auth/session/auth.session.service';
import { recordPayment, skipMonth, voidPayment } from '../../payments/payments.repository';
import { addMonths } from '../../payments/payments.service';

// Relative to the real month: the server reads the real clock.
const NOW = currentMonthInCairo();
const PREV = addMonths(NOW, -1);
const TWO_AGO = addMonths(NOW, -2);
const NEXT = addMonths(NOW, 1);

let server: Server;
let baseUrl = '';
const teacherIds: string[] = [];

type Call = (method: string, path: string, body?: unknown) => Promise<[number, any]>;

async function one<T>(sql: string, params: unknown[]): Promise<T> {
  return (await pool.query(sql, params)).rows[0] as T;
}

async function signedInTeacher(name: string): Promise<{ id: string; call: Call }> {
  const { id } = await one<{ id: string }>(
    `INSERT INTO teachers (full_name, email) VALUES ($1, $2) RETURNING id::text AS id`,
    [name, `profile-api-${name}-${Date.now()}@example.com`]
  );
  teacherIds.push(id);
  const { token } = await startTeacherSession(id, false);

  const call: Call = async (method, path, body) => {
    const response = await fetch(`${baseUrl}/api/v1/teacher${path}`, {
      method,
      headers: {
        origin: getFrontendOrigin(),
        cookie: `${AUTH_COOKIE_NAME}=${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? null : JSON.stringify(body),
    });
    const text = await response.text();
    return [response.status, text ? JSON.parse(text) : null];
  };

  return { id, call };
}

async function addGrade(teacherId: string, name: string, fee: number) {
  const grade = await one<{ id: string }>(
    `INSERT INTO grades (teacher_id, name, monthly_fee) VALUES ($1, $2, $3) RETURNING id::text AS id`,
    [teacherId, name, fee]
  );
  const group = await one<{ id: string }>(
    `INSERT INTO groups (teacher_id, grade_id, name) VALUES ($1, $2, 'Group A') RETURNING id::text AS id`,
    [teacherId, grade.id]
  );
  return { gradeId: grade.id, groupId: group.id };
}

// Joined on the 1st of `month`, at noon in Egypt.
async function addStudent(
  teacherId: string,
  where: { gradeId: string; groupId: string },
  name: string,
  month: string,
  discount = 0
) {
  return (
    await one<{ id: string }>(
      `
        INSERT INTO students (teacher_id, grade_id, group_id, full_name, code, created_at, discount_percent)
        VALUES ($1, $2, $3, $4, $5, ($6::date + TIME '12:00') AT TIME ZONE 'Africa/Cairo', $7)
        RETURNING id::text AS id
      `,
      [
        teacherId,
        where.gradeId,
        where.groupId,
        name,
        `PR-${name}-${Date.now() % 100000}`,
        `${month}-01`,
        discount,
      ]
    )
  ).id;
}

async function addExam(
  teacherId: string,
  gradeId: string,
  title: string,
  day: string,
  max: number
) {
  return (
    await one<{ id: string }>(
      `
        INSERT INTO exams (teacher_id, grade_id, title, kind, held_on, max_mark, pass_mark)
        VALUES ($1, $2, $3, 'quiz', $4, $5, 1)
        RETURNING id::text AS id
      `,
      [teacherId, gradeId, title, day, max]
    )
  ).id;
}

async function addResult(examId: string, studentId: string, score: number | null) {
  await pool.query(
    `
      INSERT INTO exam_results (exam_id, student_id, grade_id, max_mark, status, score)
      SELECT e.id, $2, e.grade_id, e.max_mark, $3, $4 FROM exams e WHERE e.id = $1
    `,
    [examId, studentId, score === null ? 'absent' : 'scored', score]
  );
}

async function pay(
  teacherId: string,
  studentId: string,
  month: string,
  amount: number,
  paidOn: string
) {
  const outcome = await recordPayment(
    teacherId,
    {
      requestId: randomUUID(),
      studentId,
      months: [month],
      amount,
      paidOn,
      method: 'cash',
      note: null,
    },
    NOW
  );
  assert.equal(outcome.status, 'recorded');
  return outcome.status === 'recorded' ? outcome.paymentId : '';
}

let A: Call;
let B: Call;
let grade = { gradeId: '', groupId: '' };
let mona = ''; // a full history: marks of every kind, paid, partly, skipped, ahead
let karim = ''; // joined this month: nothing yet
const exams: Record<string, string> = {};

before(async () => {
  await assertTestDatabase();
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const a = await signedInTeacher('a');
  const b = await signedInTeacher('b');
  A = a.call;
  B = b.call;

  grade = await addGrade(a.id, 'Grade 3', 200);
  const otherGrade = await addGrade(a.id, 'Grade 1', 100);

  // 25% off: 150 a month.
  mona = await addStudent(a.id, grade, 'Mona', TWO_AGO, 25);
  karim = await addStudent(a.id, grade, 'Karim', NOW);

  // Mona: 90% this month; 75% and 70% last month; one absent, one not entered.
  exams.thisMonth = await addExam(a.id, grade.gradeId, 'This month', `${NOW}-01`, 20);
  exams.lastA = await addExam(a.id, grade.gradeId, 'Last A', `${PREV}-15`, 20);
  exams.lastB = await addExam(a.id, grade.gradeId, 'Last B', `${PREV}-20`, 10);
  exams.absent = await addExam(a.id, grade.gradeId, 'Absent', `${PREV}-05`, 20);
  exams.notEntered = await addExam(a.id, grade.gradeId, 'Not entered', `${PREV}-10`, 20);
  exams.upcoming = await addExam(a.id, grade.gradeId, 'Upcoming', `${NEXT}-01`, 20);
  await addExam(a.id, otherGrade.gradeId, 'Other grade', `${PREV}-12`, 20);

  await addResult(exams.thisMonth, mona, 18);
  await addResult(exams.lastA, mona, 15);
  await addResult(exams.lastB, mona, 7);
  await addResult(exams.absent, mona, null);

  // Mona's fees: two months ago paid, last month skipped, this month partly
  // (after a voided payment), next month paid ahead.
  await pay(a.id, mona, TWO_AGO, 150, `${TWO_AGO}-10`);
  assert.equal((await skipMonth(a.id, mona, PREV, 'Travelling')).status, 'skipped');
  // Dated today, so a voided payment would show as the latest if it counted.
  const mistake = await pay(a.id, mona, NOW, 50, todayInCairo());
  assert.equal((await voidPayment(a.id, mistake, 'Wrong student')).status, 'voided');
  await pay(a.id, mona, NOW, 100, `${NOW}-01`);
  await pay(a.id, mona, NEXT, 150, `${NOW}-01`);
});

after(async () => {
  server.close();
  await pool.query('DELETE FROM teachers WHERE id = ANY ($1::bigint[])', [teacherIds]);
  await pool.end();
});

const day = (iso: string | null) => iso?.slice(0, 10) ?? null;

/* ---------------------------------- Marks --------------------------------- */

describe('marks', () => {
  it('lists every exam the student is on, newest first, without upcoming ones', async () => {
    const [status, body] = await A('GET', `/students/${mona}/exams`);

    assert.equal(status, 200);
    assert.deepEqual(
      body.exams.map((exam: any) => [exam.title, exam.status, exam.score, exam.maxScore]),
      [
        ['This month', 'scored', 18, 20],
        ['Last B', 'scored', 7, 10],
        ['Last A', 'scored', 15, 20],
        ['Not entered', 'not-entered', null, 20],
        ['Absent', 'absent', null, 20],
      ]
    );
    assert.equal(day(body.exams[0].heldAt), `${NOW}-01`);
  });

  it('the average counts real marks only; the change compares this month with last', async () => {
    const [, body] = await A('GET', `/students/${mona}`);

    // (90 + 75 + 70) / 3 = 78.3; this month 90, last month 72.5 -> +17.5
    assert.deepEqual(body.profile.summary.marks, {
      average: 78,
      examCount: 3,
      changeSinceLastMonth: 18,
    });
  });

  it('a student who joined after an exam is not on it', async () => {
    const [, body] = await A('GET', `/students/${karim}/exams`);

    assert.deepEqual(
      body.exams.map((exam: any) => [exam.title, exam.status]),
      [['This month', 'not-entered']]
    );
  });

  it('no marks yet: a null average, not 0', async () => {
    const [, body] = await A('GET', `/students/${karim}`);

    assert.deepEqual(body.profile.summary.marks, {
      average: null,
      examCount: 0,
      changeSinceLastMonth: null,
    });
  });

  it("agrees with each exam's page", async () => {
    const [, body] = await A('GET', `/students/${mona}/exams`);

    for (const exam of body.exams) {
      const [, page] = await A('GET', `/exams/${exam.examId}`);
      const row = page.results.find((result: any) => result.student.id === mona);
      assert.deepEqual([row.status, row.score], [exam.status, exam.score], exam.title);
    }
  });
});

/* -------------------------------- Payments -------------------------------- */

describe('payments', () => {
  it('every month from joining, newest first, with paid ahead on top', async () => {
    const [status, body] = await A('GET', `/students/${mona}/payments`);

    assert.equal(status, 200);
    assert.deepEqual(
      body.payments.map((month: any) => ({ ...month, lastPaidAt: day(month.lastPaidAt) })),
      [
        {
          month: NEXT,
          amountDue: 150,
          amountPaid: 150,
          status: 'paid',
          skipReason: null,
          lastPaidAt: `${NOW}-01`,
        },
        {
          month: NOW,
          amountDue: 150,
          amountPaid: 100,
          status: 'partly',
          skipReason: null,
          lastPaidAt: `${NOW}-01`,
        },
        {
          month: PREV,
          amountDue: 0,
          amountPaid: 0,
          status: 'skipped',
          skipReason: 'Travelling',
          lastPaidAt: null,
        },
        {
          month: TWO_AGO,
          amountDue: 150,
          amountPaid: 150,
          status: 'paid',
          skipReason: null,
          lastPaidAt: `${TWO_AGO}-10`,
        },
      ]
    );
  });

  it("the fee tile is this month's row", async () => {
    const [, list] = await A('GET', `/students/${mona}/payments`);
    const [, body] = await A('GET', `/students/${mona}`);

    assert.deepEqual(
      body.profile.summary.currentFee,
      list.payments.find((month: any) => month.month === NOW)
    );
  });

  it('a student who joined this month owes this month only', async () => {
    const [, body] = await A('GET', `/students/${karim}/payments`);

    assert.deepEqual(
      body.payments.map((month: any) => [month.month, month.amountDue, month.status]),
      [[NOW, 200, 'unpaid']]
    );
  });

  it('agrees with the payments page, month by month', async () => {
    const [, page] = await A('GET', `/payments/grades/${grade.gradeId}?month=${NOW}`);
    const [, profile] = await A('GET', `/students/${mona}/payments`);
    const row = page.students.find((entry: any) => entry.student.id === mona);

    for (const cell of row.cells) {
      const month = profile.payments.find((entry: any) => entry.month === cell.month);
      if (cell.notDueReason === 'before-joining') {
        assert.equal(month, undefined, cell.month);
        continue;
      }
      assert.deepEqual(
        [month.amountDue, month.amountPaid, month.status, month.skipReason],
        [cell.due, cell.paid, cell.status, cell.skipReason],
        cell.month
      );
    }
  });
});

/* -------------------------------- Grade table ------------------------------ */

describe('the grade table', () => {
  it("shows the same average and this month's fee as the profile", async () => {
    const [status, body] = await A('GET', `/grades/${grade.gradeId}/students`);
    const byName = Object.fromEntries(body.students.map((s: any) => [s.name, s]));

    assert.equal(status, 200);
    assert.deepEqual([byName.Mona.averageMark, byName.Mona.paymentStatus], [78, 'partly']);
    assert.deepEqual([byName.Karim.averageMark, byName.Karim.paymentStatus], [null, 'unpaid']);
  });

  it('a student just added comes back with this month already due', async () => {
    const [status, body] = await A('POST', `/grades/${grade.gradeId}/students`, {
      fullName: 'New Student',
      parentPhone: '01012345678',
      phone: null,
      groupId: grade.groupId,
      notes: null,
    });

    assert.equal(status, 201);
    assert.equal(body.student.averageMark, null);
    assert.equal(body.student.paymentStatus, 'unpaid');
  });
});

/* -------------------------------- Ownership ------------------------------- */

describe('ownership', () => {
  it("another teacher's student: 404 on the profile and both lists", async () => {
    for (const path of ['', '/exams', '/payments']) {
      const [status, body] = await B('GET', `/students/${mona}${path}`);
      assert.equal(status, 404, path);
      assert.equal(body.code, 'STUDENT_NOT_FOUND', path);
    }
  });
});

/* -------------------------------- Contract -------------------------------- */

describe('the shape the frontend reads', () => {
  it('exam and payment rows have exactly these keys', async () => {
    const [, examsBody] = await A('GET', `/students/${mona}/exams`);
    const [, paymentsBody] = await A('GET', `/students/${mona}/payments`);

    assert.deepEqual(Object.keys(examsBody.exams[0]).sort(), [
      'examId',
      'heldAt',
      'kind',
      'maxScore',
      'score',
      'status',
      'title',
    ]);
    assert.deepEqual(Object.keys(paymentsBody.payments[0]).sort(), [
      'amountDue',
      'amountPaid',
      'lastPaidAt',
      'month',
      'skipReason',
      'status',
    ]);
  });
});
