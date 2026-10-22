// The HTTP layer of /teacher/payments: auth, validation, ownership and the exact
// JSON the frontend reads. The SQL itself is covered by the repository tests.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

import app from '../../app';
import { pool } from '../../config/db';
import { getFrontendOrigin } from '../../config/frontendOrigin';
import { assertTestDatabase } from '../../test/assertTestDatabase';
import { currentMonthInCairo } from '../../utils/cairoDate';
import { AUTH_COOKIE_NAME } from '../auth/auth.cookie';
import { startTeacherSession } from '../auth/session/auth.session.service';

import { recordPayment } from './payments.repository';
import { addMonths } from './payments.service';

// Relative to the real current month: the server reads the real clock.
const NOW = currentMonthInCairo();
const PREV = addMonths(NOW, -1);
const TWO_AGO = addMonths(NOW, -2);
const NEXT = addMonths(NOW, 1);

let server: Server;
let baseUrl = '';

type Call = (path: string, withCookie?: boolean) => Promise<[number, any]>;
type Send = (method: string, path: string, body?: unknown) => Promise<[number, any]>;

async function one<T>(sql: string, params: unknown[]): Promise<T> {
  return (await pool.query(sql, params)).rows[0] as T;
}

async function signedInTeacher(name: string): Promise<{ id: string; get: Call; send: Send }> {
  const { id } = await one<{ id: string }>(
    `INSERT INTO teachers (full_name, email) VALUES ($1, $2) RETURNING id::text AS id`,
    [name, `payments-api-${name}-${Date.now()}@example.com`]
  );
  const { token } = await startTeacherSession(id, false);

  const get: Call = async (path, withCookie = true) => {
    const response = await fetch(`${baseUrl}/api/v1/teacher/payments${path}`, {
      headers: {
        origin: getFrontendOrigin(),
        ...(withCookie ? { cookie: `${AUTH_COOKIE_NAME}=${token}` } : {}),
      },
    });
    const text = await response.text();
    return [response.status, text ? JSON.parse(text) : null];
  };

  const send: Send = async (method, path, body) => {
    const response = await fetch(`${baseUrl}/api/v1/teacher/payments${path}`, {
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

  return { id, get, send };
}

async function addGrade(teacherId: string, name: string, fee: number | null) {
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
  month: string
) {
  return (
    await one<{ id: string }>(
      `
        INSERT INTO students (teacher_id, grade_id, group_id, full_name, code, created_at)
        VALUES ($1, $2, $3, $4, $5, ($6::date + TIME '12:00') AT TIME ZONE 'Africa/Cairo')
        RETURNING id::text AS id
      `,
      [
        teacherId,
        where.gradeId,
        where.groupId,
        name,
        `PA-${name}-${Date.now() % 100000}`,
        `${month}-01`,
      ]
    )
  ).id;
}

let A: Call; // has grades, students and a payment
let B: Call; // brand new: nothing at all
let sendA: Send;
let sendB: Send;
let teacherA = '';
const teacherIds: string[] = [];
let grade = { gradeId: '', groupId: '' };
let noFeeGrade = { gradeId: '', groupId: '' };
let ali = '';
let sara = '';

before(async () => {
  await assertTestDatabase();

  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const a = await signedInTeacher('a');
  const b = await signedInTeacher('b');
  A = a.get;
  B = b.get;
  sendA = a.send;
  sendB = b.send;
  teacherA = a.id;
  teacherIds.push(a.id, b.id);

  grade = await addGrade(a.id, 'Grade 3', 200);
  noFeeGrade = await addGrade(a.id, 'Grade 1', null);

  ali = await addStudent(a.id, grade, 'Ali', TWO_AGO);
  sara = await addStudent(a.id, grade, 'Sara', TWO_AGO);
  await addStudent(a.id, noFeeGrade, 'Omar', TWO_AGO);

  // Ali: 500 over three months -> 200, 200, 100. Sara pays nothing.
  const outcome = await recordPayment(
    a.id,
    {
      requestId: randomUUID(),
      studentId: ali,
      months: [TWO_AGO, PREV, NOW],
      amount: 500,
      paidOn: `${NOW}-01`,
      method: 'cash',
      note: null,
    },
    NOW
  );
  assert.equal(outcome.status, 'recorded');
});

after(async () => {
  server.close();
  await pool.query('DELETE FROM teachers WHERE id = ANY ($1::bigint[])', [teacherIds]);
  await pool.end();
});

const sortedKeys = (value: object) => Object.keys(value).sort();

/* ---------------------------------- Guards -------------------------------- */

describe('guards', () => {
  it('no session: 401 on both endpoints', async () => {
    assert.equal((await A(`/overview?month=${NOW}`, false))[0], 401);
    assert.equal((await A(`/grades/${grade.gradeId}?month=${NOW}`, false))[0], 401);
  });

  it('a missing or malformed month: 400 INVALID_INPUT', async () => {
    for (const query of ['', '?month=', '?month=2026-13', '?month=oct', '?month=2026-1']) {
      const [status, body] = await A(`/overview${query}`);
      assert.equal(status, 400, query);
      assert.equal(body.code, 'INVALID_INPUT', query);
    }
  });

  it('a month that hasn’t come yet: 400', async () => {
    const [status, body] = await A(`/grades/${grade.gradeId}?month=${NEXT}`);
    assert.equal(status, 400);
    assert.equal(body.code, 'INVALID_INPUT');
  });

  it('a malformed grade id: 404 GRADE_NOT_FOUND, not a 500', async () => {
    for (const id of ['abc', '0', '-1', '1.5']) {
      const [status, body] = await A(`/grades/${id}?month=${NOW}`);
      assert.equal(status, 404, id);
      assert.equal(body.code, 'GRADE_NOT_FOUND', id);
    }
  });
});

/* -------------------------------- Ownership ------------------------------- */

describe('ownership', () => {
  it("another teacher's grade: 404, same as one that doesn't exist", async () => {
    const [status, body] = await B(`/grades/${grade.gradeId}?month=${NOW}`);
    assert.equal(status, 404);
    assert.equal(body.code, 'GRADE_NOT_FOUND');

    assert.deepEqual(await B(`/grades/999999999?month=${NOW}`), [status, body]);
  });

  it("another teacher's overview has none of A's money", async () => {
    const [, overview] = await B(`/overview?month=${NOW}`);
    assert.equal(overview.hasAnyPayment, false);
    assert.equal(overview.latest.length, 0);
    assert.equal(overview.totals.collected, 0);
  });
});

/* -------------------------------- Overview -------------------------------- */

describe('GET /overview', () => {
  it('a brand new teacher: 200 with an empty month, not an error', async () => {
    const [status, overview] = await B(`/overview?month=${NOW}`);

    assert.equal(status, 200);
    assert.deepEqual(overview, {
      month: NOW,
      hasAnyPayment: false,
      totals: {
        expected: 0,
        collected: 0,
        owed: 0,
        students: { paid: 0, partly: 0, unpaid: 0, skipped: 0 },
      },
      earlierOwed: null,
      latest: [],
    });
  });

  it("this month's totals and student counts", async () => {
    const [status, overview] = await A(`/overview?month=${NOW}`);

    assert.equal(status, 200);
    assert.equal(overview.hasAnyPayment, true);
    // Ali 200 + Sara 200 due; the no-fee grade adds nothing.
    assert.deepEqual(overview.totals, {
      expected: 400,
      collected: 100,
      owed: 300,
      students: { paid: 0, partly: 1, unpaid: 1, skipped: 0 },
    });
  });

  it('earlier owed: only months before the one shown', async () => {
    const [, overview] = await A(`/overview?month=${NOW}`);

    // Sara's two earlier months; Ali paid his.
    assert.deepEqual(overview.earlierOwed, { students: 1, amount: 400, gradeId: grade.gradeId });
  });

  it('latest payments: one row per payment, with the months it covered', async () => {
    const [, overview] = await A(`/overview?month=${NOW}`);

    assert.equal(overview.latest.length, 1);
    const [payment] = overview.latest;
    assert.equal(payment.amount, 500);
    assert.equal(payment.paidOn, `${NOW}-01`);
    assert.deepEqual(payment.months, [TWO_AGO, PREV, NOW]);
    assert.deepEqual(payment.student, { id: ali, name: 'Ali' });
    assert.deepEqual(payment.grade, { id: grade.gradeId, name: 'Grade 3' });
  });
});

/* -------------------------------- One grade ------------------------------- */

describe('GET /grades/:gradeId', () => {
  it('the five-month window around the month asked for', async () => {
    const [status, data] = await A(`/grades/${grade.gradeId}?month=${NOW}`);

    assert.equal(status, 200);
    assert.equal(data.month, NOW);
    assert.deepEqual(data.months, [addMonths(NOW, -3), TWO_AGO, PREV, NOW, NEXT]);
  });

  it('a past month moves the window and the selected cell', async () => {
    const [, data] = await A(`/grades/${grade.gradeId}?month=${PREV}`);

    assert.deepEqual(data.months, [addMonths(PREV, -3), addMonths(PREV, -2), TWO_AGO, PREV, NOW]);
    assert.ok(data.students.every((row: any) => row.selected.month === PREV));
  });

  it('each student: one cell per month, the selected month, and what they owe', async () => {
    const [, data] = await A(`/grades/${grade.gradeId}?month=${NOW}`);

    assert.deepEqual(
      data.students.map((row: any) => row.student.name),
      ['Ali', 'Sara']
    );

    const [aliRow, saraRow] = data.students;
    assert.equal(aliRow.cells.length, 5);
    assert.equal(aliRow.selected.status, 'partly');
    assert.equal(aliRow.selected.left, 100);
    assert.equal(aliRow.owes, 100);

    assert.equal(saraRow.student.id, sara);
    assert.equal(saraRow.selected.status, 'unpaid');
    assert.equal(saraRow.owes, 600);
  });

  it('cells before joining and in the future say why nothing is due', async () => {
    const [, data] = await A(`/grades/${grade.gradeId}?month=${NOW}`);
    const cells = data.students[1].cells;

    assert.equal(cells[0].status, 'not-due');
    assert.equal(cells[0].notDueReason, 'before-joining');
    assert.equal(cells[4].status, 'not-due');
    assert.equal(cells[4].notDueReason, 'future');
  });

  it("a payment appears in each month it covered, with that month's share", async () => {
    const [, data] = await A(`/grades/${grade.gradeId}?month=${NOW}`);
    const cells = data.students[0].cells;

    assert.deepEqual(
      cells.slice(1, 4).map((cell: any) => cell.payments.map((payment: any) => payment.amount)),
      [[200], [200], [100]]
    );
    assert.equal(cells[3].payments[0].voided, null);
  });

  it("the grade's totals for the selected month", async () => {
    const [, data] = await A(`/grades/${grade.gradeId}?month=${NOW}`);

    assert.deepEqual(data.grade, { id: grade.gradeId, name: 'Grade 3', fee: 200 });
    assert.deepEqual(data.totals, {
      expected: 400,
      collected: 100,
      owed: 300,
      unpaid: 1,
      partly: 1,
    });
  });

  it('a grade with no fee yet: fee 0 and nothing due', async () => {
    const [status, data] = await A(`/grades/${noFeeGrade.gradeId}?month=${NOW}`);

    assert.equal(status, 200);
    assert.equal(data.grade.fee, 0);
    assert.equal(data.students[0].selected.status, 'not-due');
    assert.equal(data.totals.expected, 0);
  });
});

/* -------------------------------- Contract -------------------------------- */

// Exactly the fields of frontend/src/api/payments/payments.ts: a rename on
// either side fails here before it breaks the page.
describe('the response matches the frontend contract', () => {
  it('PaymentsOverview', async () => {
    const [, overview] = await A(`/overview?month=${NOW}`);

    assert.deepEqual(sortedKeys(overview), [
      'earlierOwed',
      'hasAnyPayment',
      'latest',
      'month',
      'totals',
    ]);
    assert.deepEqual(sortedKeys(overview.totals), ['collected', 'expected', 'owed', 'students']);
    assert.deepEqual(sortedKeys(overview.latest[0]), [
      'amount',
      'grade',
      'id',
      'method',
      'months',
      'paidOn',
      'student',
    ]);
  });

  it('GradePayments', async () => {
    const [, data] = await A(`/grades/${grade.gradeId}?month=${NOW}`);
    const row = data.students[0];

    assert.deepEqual(sortedKeys(data), [
      'grade',
      'groups',
      'month',
      'months',
      'students',
      'totals',
    ]);
    assert.deepEqual(sortedKeys(row), ['cells', 'groupName', 'owes', 'selected', 'student']);
    assert.deepEqual(sortedKeys(row.student), [
      'code',
      'discountPercent',
      'discountReason',
      'groupId',
      'id',
      'name',
    ]);
    assert.deepEqual(sortedKeys(row.selected), [
      'discountPercent',
      'due',
      'gradeFee',
      'left',
      'month',
      'notDueReason',
      'note',
      'paid',
      'payments',
      'skipReason',
      'status',
    ]);
    assert.deepEqual(sortedKeys(row.selected.payments[0]), [
      'amount',
      'id',
      'method',
      'note',
      'paidOn',
      'voided',
    ]);
  });
});

/* ================================= Writes ================================= */

// Their own grade and students, so the reads above keep their numbers.
describe('writes', () => {
  let writeGrade = { gradeId: '', groupId: '' };
  const s = { rec: '', voider: '', skipper: '', noter: '', dup: '' };

  before(async () => {
    writeGrade = await addGrade(teacherA, 'Grade 2', 200);
    for (const name of Object.keys(s) as (keyof typeof s)[]) {
      s[name] = await addStudent(teacherA, writeGrade, `W-${name}`, TWO_AGO);
    }
  });

  const rowOf = (data: any, studentId: string) =>
    data.students.find((row: any) => row.student.id === studentId);
  const cellOf = (data: any, studentId: string, month: string) =>
    rowOf(data, studentId).cells.find((cell: any) => cell.month === month);

  const payment = (studentId: string, overrides: Record<string, unknown> = {}) => ({
    requestId: randomUUID(),
    studentId,
    months: [PREV, NOW],
    amount: 300,
    paidOn: `${NOW}-01`,
    method: 'cash',
    note: null,
    ...overrides,
  });

  /* ----------------------------- Record a payment ---------------------------- */

  describe('POST / (record)', () => {
    it('answers with the fresh grade: 300 over two months is paid, then partly', async () => {
      const [status, data] = await sendA('POST', `/?month=${NOW}`, payment(s.rec, { note: '  ' }));

      assert.equal(status, 200);
      assert.equal(data.grade.id, writeGrade.gradeId);
      assert.equal(data.month, NOW);
      assert.equal(cellOf(data, s.rec, PREV).status, 'paid');
      assert.equal(cellOf(data, s.rec, NOW).status, 'partly');
      assert.equal(cellOf(data, s.rec, NOW).left, 100);
      // A blank note is stored as no note.
      assert.equal(cellOf(data, s.rec, NOW).payments[0].note, null);
    });

    it('answers for the month on screen (?month=)', async () => {
      const [status, data] = await sendA(
        'POST',
        `/?month=${PREV}`,
        payment(s.rec, { months: [NOW], amount: 100 })
      );

      assert.equal(status, 200);
      assert.equal(data.month, PREV);
      assert.equal(rowOf(data, s.rec).selected.month, PREV);
    });

    it('a double click: both answers are 200, one payment is saved', async () => {
      const body = payment(s.dup);
      const [first, second] = await Promise.all([
        sendA('POST', `/?month=${NOW}`, body),
        sendA('POST', `/?month=${NOW}`, body),
      ]);

      assert.equal(first[0], 200);
      assert.equal(second[0], 200);
      const { n } = await one<{ n: number }>(
        'SELECT COUNT(*)::int AS n FROM payments WHERE student_id = $1',
        [s.dup]
      );
      assert.equal(n, 1);
    });

    it('a bad body: 400 INVALID_INPUT', async () => {
      const bad: [string, Record<string, unknown>][] = [
        ['unknown field', { extra: true }],
        ['amount 0', { amount: 0 }],
        ['negative amount', { amount: -5 }],
        ['amount with piasters', { amount: 10.5 }],
        ['no months', { months: [] }],
        ['the same month twice', { months: [NOW, NOW] }],
        ['two months ahead', { months: [addMonths(NOW, 2)] }],
        ['a month like 2026-13', { months: ['2026-13'] }],
        ['paid on a future day', { paidOn: '2099-01-01' }],
        ['paid on a day that does not exist', { paidOn: '2026-02-30' }],
        ['unknown method', { method: 'cheque' }],
        ['requestId not a uuid', { requestId: 'abc' }],
        ['no studentId', { studentId: undefined }],
      ];

      for (const [label, overrides] of bad) {
        const [status, body] = await sendA('POST', `/?month=${NOW}`, payment(s.rec, overrides));
        assert.equal(status, 400, label);
        assert.equal(body.code, 'INVALID_INPUT', label);
      }
    });

    it('no ?month=: 400', async () => {
      assert.equal((await sendA('POST', '/', payment(s.rec)))[0], 400);
    });

    it('a month before the student joined: 400 MONTH_BEFORE_JOINING', async () => {
      const [status, body] = await sendA(
        'POST',
        `/?month=${NOW}`,
        payment(s.rec, { months: [addMonths(NOW, -3)] })
      );
      assert.equal(status, 400);
      assert.equal(body.code, 'MONTH_BEFORE_JOINING');
    });

    it("another teacher's student: 404 STUDENT_NOT_FOUND", async () => {
      const [status, body] = await sendB('POST', `/?month=${NOW}`, payment(s.rec));
      assert.equal(status, 404);
      assert.equal(body.code, 'STUDENT_NOT_FOUND');
    });
  });

  /* ------------------------------ Void a payment ----------------------------- */

  describe('POST /:paymentId/void', () => {
    let paymentId = '';

    before(async () => {
      const [, data] = await sendA('POST', `/?month=${NOW}`, payment(s.voider));
      paymentId = cellOf(data, s.voider, NOW).payments[0].id;
    });

    it("another teacher's payment: 404, and it stays counted", async () => {
      const [status, body] = await sendB('POST', `/${paymentId}/void?month=${NOW}`, {
        reason: 'x',
      });
      assert.equal(status, 404);
      assert.equal(body.code, 'PAYMENT_NOT_FOUND');
    });

    it('a blank reason or an extra field: 400', async () => {
      assert.equal(
        (await sendA('POST', `/${paymentId}/void?month=${NOW}`, { reason: '  ' }))[0],
        400
      );
      assert.equal(
        (await sendA('POST', `/${paymentId}/void?month=${NOW}`, { reason: 'x', extra: 1 }))[0],
        400
      );
    });

    it('voids: the months go back to unpaid, and the payment shows why', async () => {
      const [status, data] = await sendA('POST', `/${paymentId}/void?month=${NOW}`, {
        reason: ' wrong student ',
      });

      assert.equal(status, 200);
      assert.equal(cellOf(data, s.voider, PREV).status, 'unpaid');
      assert.equal(cellOf(data, s.voider, NOW).status, 'unpaid');
      assert.equal(cellOf(data, s.voider, NOW).payments[0].voided.reason, 'wrong student');
    });

    it('voiding twice: 409 PAYMENT_ALREADY_VOIDED', async () => {
      const [status, body] = await sendA('POST', `/${paymentId}/void?month=${NOW}`, {
        reason: 'again',
      });
      assert.equal(status, 409);
      assert.equal(body.code, 'PAYMENT_ALREADY_VOIDED');
    });

    it('a malformed or unknown payment id: 404', async () => {
      for (const id of ['abc', '999999999']) {
        const [status, body] = await sendA('POST', `/${id}/void?month=${NOW}`, { reason: 'x' });
        assert.equal(status, 404, id);
        assert.equal(body.code, 'PAYMENT_NOT_FOUND', id);
      }
    });
  });

  /* ------------------------------- Skip / unskip ----------------------------- */

  describe('PUT and DELETE /students/:studentId/months/:month/skip', () => {
    const skipPath = (studentId: string, month: string) =>
      `/students/${studentId}/months/${month}/skip?month=${NOW}`;

    it('skips: nothing is due and the reason shows', async () => {
      const [status, data] = await sendA('PUT', skipPath(s.skipper, NOW), { reason: 'Travelling' });

      assert.equal(status, 200);
      assert.equal(cellOf(data, s.skipper, NOW).status, 'skipped');
      assert.equal(cellOf(data, s.skipper, NOW).skipReason, 'Travelling');
    });

    it('a skipped month can not be paid: 409 MONTH_SKIPPED', async () => {
      const [status, body] = await sendA(
        'POST',
        `/?month=${NOW}`,
        payment(s.skipper, { months: [NOW] })
      );
      assert.equal(status, 409);
      assert.equal(body.code, 'MONTH_SKIPPED');
    });

    it('undo: the month is due again (and undoing twice is harmless)', async () => {
      const [status, data] = await sendA('DELETE', skipPath(s.skipper, NOW));
      assert.equal(status, 200);
      assert.equal(cellOf(data, s.skipper, NOW).status, 'unpaid');

      assert.equal((await sendA('DELETE', skipPath(s.skipper, NOW)))[0], 200);
    });

    it('a month with payments: 409 MONTH_HAS_PAYMENTS', async () => {
      const [status, body] = await sendA('PUT', skipPath(s.rec, PREV), { reason: 'x' });
      assert.equal(status, 409);
      assert.equal(body.code, 'MONTH_HAS_PAYMENTS');
    });

    it('a month before joining: 400 MONTH_BEFORE_JOINING', async () => {
      const [status, body] = await sendA('PUT', skipPath(s.skipper, addMonths(NOW, -3)), {
        reason: 'x',
      });
      assert.equal(status, 400);
      assert.equal(body.code, 'MONTH_BEFORE_JOINING');
    });

    it('a bad month in the path or a blank reason: 400', async () => {
      for (const month of ['2026-13', 'oct', addMonths(NOW, 2)]) {
        assert.equal(
          (await sendA('PUT', skipPath(s.skipper, month), { reason: 'x' }))[0],
          400,
          month
        );
      }
      assert.equal((await sendA('PUT', skipPath(s.skipper, NOW), { reason: '' }))[0], 400);
    });

    it("a malformed id or another teacher's student: 404 STUDENT_NOT_FOUND", async () => {
      const [status, body] = await sendA('PUT', skipPath('abc', NOW), { reason: 'x' });
      assert.equal(status, 404);
      assert.equal(body.code, 'STUDENT_NOT_FOUND');

      assert.equal((await sendB('PUT', skipPath(s.skipper, NOW), { reason: 'x' }))[0], 404);
      assert.equal((await sendB('DELETE', skipPath(s.skipper, NOW)))[0], 404);
    });
  });

  /* ---------------------------------- Notes ---------------------------------- */

  describe('PUT /students/:studentId/months/:month/note', () => {
    const notePath = `/students/${'{id}'}/months/${NOW}/note?month=${NOW}`;
    const pathFor = (studentId: string) => notePath.replace('{id}', studentId);

    it('saves the note, trimmed', async () => {
      const [status, data] = await sendA('PUT', pathFor(s.noter), {
        text: '  Mom pays on the 15th ',
      });
      assert.equal(status, 200);
      assert.equal(cellOf(data, s.noter, NOW).note, 'Mom pays on the 15th');
    });

    it('empty text removes it', async () => {
      const [status, data] = await sendA('PUT', pathFor(s.noter), { text: '' });
      assert.equal(status, 200);
      assert.equal(cellOf(data, s.noter, NOW).note, null);
    });

    it('too long, or missing text: 400', async () => {
      assert.equal((await sendA('PUT', pathFor(s.noter), { text: 'x'.repeat(301) }))[0], 400);
      assert.equal((await sendA('PUT', pathFor(s.noter), {}))[0], 400);
    });

    it("another teacher's student: 404", async () => {
      assert.equal((await sendB('PUT', pathFor(s.noter), { text: 'x' }))[0], 404);
    });
  });
});
