// Runs against the real test database: CHECKs and locks can't be mocked.
// Each run makes its own teachers and deletes them at the end.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { pool } from '../../config/db';
import { isCheckViolation, isUniqueViolation } from '../../errors/pgErrors';
import { assertTestDatabase } from '../../test/assertTestDatabase';

import * as repo from './payments.repository';

// Fixed, so results don't depend on today's date.
const NOW = '2026-10';

const run = Date.now();
let teacherA = '';
let teacherB = '';
let gradeA = ''; // teacher A, fee 200
let gradeNoFee = ''; // teacher A, a free grade (fee 0)
let gradeB = ''; // teacher B
type StudentName =
  | 'ali'
  | 'sara'
  | 'omar'
  | 'dup'
  | 'race'
  | 'voider'
  | 'skipper'
  | 'noter'
  | 'ahead'
  | 'nofee'
  | 'other';
const s = {} as Record<StudentName, string>; // students by short name

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const result = await pool.query(sql, params);
  return result.rows[0] as T;
}

async function addTeacher(name: string) {
  return (
    await one<{ id: string }>(
      `INSERT INTO teachers (full_name, email) VALUES ($1, $2) RETURNING id::text AS id`,
      [name, `payments-test-${name}-${run}@example.com`]
    )
  ).id;
}

async function addGrade(teacherId: string, name: string, fee: number) {
  return (
    await one<{ id: string }>(
      `INSERT INTO grades (teacher_id, name, monthly_fee) VALUES ($1, $2, $3) RETURNING id::text AS id`,
      [teacherId, `${name} ${run}`, fee]
    )
  ).id;
}

async function addGroup(teacherId: string, gradeId: string) {
  return (
    await one<{ id: string }>(
      `INSERT INTO groups (teacher_id, grade_id, name) VALUES ($1, $2, 'Group A') RETURNING id::text AS id`,
      [teacherId, gradeId]
    )
  ).id;
}

// joinedOn: the day the student was added, in Egypt (noon, to be safe).
async function addStudent(
  teacherId: string,
  gradeId: string,
  groupId: string,
  name: string,
  joinedOn: string,
  discount = 0
) {
  return (
    await one<{ id: string }>(
      `
        INSERT INTO students
          (teacher_id, grade_id, group_id, full_name, code, created_at, discount_percent)
        VALUES ($1, $2, $3, $4, $5, ($6::date + TIME '12:00') AT TIME ZONE 'Africa/Cairo', $7)
        RETURNING id::text AS id
      `,
      [teacherId, gradeId, groupId, name, `P-${name}-${run % 100000}`, joinedOn, discount]
    )
  ).id;
}

const payment = (
  studentId: string,
  months: string[],
  amount: number,
  overrides: Partial<repo.RecordPaymentInput> = {}
): repo.RecordPaymentInput => ({
  requestId: randomUUID(),
  studentId,
  months,
  amount,
  paidOn: '2026-10-05',
  method: 'cash',
  note: null,
  ...overrides,
});

async function record(input: repo.RecordPaymentInput) {
  const outcome = await repo.recordPayment(teacherA, input, NOW);
  assert.equal(outcome.status, 'recorded');
  return outcome as Extract<repo.RecordPaymentOutcome, { status: 'recorded' }>;
}

// One student's months as { "2026-08": row, ... }.
async function monthsOf(studentId: string, months: string[], gradeId = gradeA) {
  const rows = await repo.findGradeStudentMonths(teacherA, gradeId, months, NOW);
  return Object.fromEntries(
    rows.filter((row) => row.student_id === studentId).map((row) => [row.month, row])
  );
}

async function owesOf(studentId: string, upTo = NOW) {
  const rows = await repo.findGradeOwed(teacherA, gradeA, upTo, NOW);
  return rows.find((row) => row.student_id === studentId)?.owes ?? 0;
}

before(async () => {
  await assertTestDatabase();

  teacherA = await addTeacher('a');
  teacherB = await addTeacher('b');

  gradeA = await addGrade(teacherA, 'Grade 3', 200);
  gradeNoFee = await addGrade(teacherA, 'Grade 1', 0);
  gradeB = await addGrade(teacherB, 'Grade 3', 200);

  const groupA = await addGroup(teacherA, gradeA);
  const groupNoFee = await addGroup(teacherA, gradeNoFee);
  const groupB = await addGroup(teacherB, gradeB);

  // Each test gets its own student, so tests don't depend on each other.
  s.ali = await addStudent(teacherA, gradeA, groupA, 'Ali', '2026-08-10');
  s.sara = await addStudent(teacherA, gradeA, groupA, 'Sara', '2026-08-01', 50);
  s.omar = await addStudent(teacherA, gradeA, groupA, 'Omar', '2026-10-03');
  s.dup = await addStudent(teacherA, gradeA, groupA, 'Dup', '2026-08-01');
  s.race = await addStudent(teacherA, gradeA, groupA, 'Race', '2026-09-01');
  s.voider = await addStudent(teacherA, gradeA, groupA, 'Voider', '2026-08-01');
  s.skipper = await addStudent(teacherA, gradeA, groupA, 'Skipper', '2026-08-01');
  s.noter = await addStudent(teacherA, gradeA, groupA, 'Noter', '2026-08-01');
  s.ahead = await addStudent(teacherA, gradeA, groupA, 'Ahead', '2026-10-01');
  s.nofee = await addStudent(teacherA, gradeNoFee, groupNoFee, 'NoFee', '2026-08-01');
  s.other = await addStudent(teacherB, gradeB, groupB, 'Other', '2026-08-01');
});

after(async () => {
  await pool.query('DELETE FROM teachers WHERE id = ANY ($1::bigint[])', [[teacherA, teacherB]]);
  await pool.end();
});

/* ------------------------------- Migration -------------------------------- */

describe('the database refuses broken rows', () => {
  const insertPayment = (columns: Record<string, unknown>) => {
    const row = {
      student_id: s.ali,
      amount: 100,
      paid_on: '2026-10-01',
      method: 'cash',
      request_id: randomUUID(),
      ...columns,
    };
    const keys = Object.keys(row);
    return pool.query(
      `INSERT INTO payments (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})`,
      Object.values(row)
    );
  };

  it('an amount of 0', async () => {
    await assert.rejects(insertPayment({ amount: 0 }), (error) =>
      isCheckViolation(error, 'payments_amount_check')
    );
  });

  it('an unknown method', async () => {
    await assert.rejects(insertPayment({ method: 'cheque' }), (error) =>
      isCheckViolation(error, 'payments_method_check')
    );
  });

  it('a void without a reason', async () => {
    await assert.rejects(insertPayment({ voided_at: new Date() }), (error) =>
      isCheckViolation(error, 'payments_void_check')
    );
  });

  it('the same request_id twice', async () => {
    const requestId = randomUUID();
    await pool.query('BEGIN');
    try {
      await insertPayment({ request_id: requestId });
      await assert.rejects(insertPayment({ request_id: requestId }), (error) =>
        isUniqueViolation(error, 'payments_request_id_key')
      );
    } finally {
      await pool.query('ROLLBACK');
    }
  });

  it('a month that is not the 1st', async () => {
    await assert.rejects(
      pool.query(
        `INSERT INTO student_months (student_id, month, note) VALUES ($1, '2026-10-15', 'x')`,
        [s.ali]
      ),
      (error) => isCheckViolation(error, 'student_months_month_check')
    );
  });

  it('an empty student month (no skip, no note)', async () => {
    await assert.rejects(
      pool.query(`INSERT INTO student_months (student_id, month) VALUES ($1, '2026-10-01')`, [
        s.ali,
      ]),
      (error) => isCheckViolation(error, 'student_months_not_empty_check')
    );
  });

  it('a discount above 100%', async () => {
    await assert.rejects(
      pool.query('UPDATE students SET discount_percent = 101 WHERE id = $1', [s.ali]),
      (error) => isCheckViolation(error, 'students_discount_percent_check')
    );
  });
});

/* --------------------------------- Split ---------------------------------- */

describe('splitAmount', () => {
  const three = [
    { month: '2026-10', needs: 200 },
    { month: '2026-08', needs: 200 },
    { month: '2026-09', needs: 200 },
  ];

  it('fills months oldest first, the last takes the rest', () => {
    assert.deepEqual(repo.splitAmount(three, 500), [
      { month: '2026-08', amount: 200 },
      { month: '2026-09', amount: 200 },
      { month: '2026-10', amount: 100 },
    ]);
  });

  it('keeps an overpayment on the last month', () => {
    assert.deepEqual(
      repo.splitAmount(three, 700).map((part) => part.amount),
      [200, 200, 300]
    );
  });

  it('drops months the money did not reach', () => {
    assert.deepEqual(repo.splitAmount(three, 150), [{ month: '2026-08', amount: 150 }]);
  });

  it('the parts always add up to the amount', () => {
    for (const amount of [1, 199, 200, 401, 600, 999]) {
      const total = repo.splitAmount(three, amount).reduce((sum, part) => sum + part.amount, 0);
      assert.equal(total, amount);
    }
  });
});

/* ------------------------------ Record a payment -------------------------- */

describe('recordPayment', () => {
  it('splits 500 over Aug-Oct: paid, paid, partly', async () => {
    const outcome = await record(payment(s.ali, ['2026-10', '2026-08', '2026-09'], 500));

    assert.equal(outcome.gradeId, gradeA);
    assert.deepEqual(outcome.parts, [
      { month: '2026-08', amount: 200 },
      { month: '2026-09', amount: 200 },
      { month: '2026-10', amount: 100 },
    ]);

    const months = await monthsOf(s.ali, ['2026-08', '2026-09', '2026-10']);
    assert.equal(months['2026-08']!.status, 'paid');
    assert.equal(months['2026-09']!.status, 'paid');
    assert.equal(months['2026-10']!.status, 'partly');
    assert.equal(months['2026-10']!.left, 100);
    assert.equal(await owesOf(s.ali), 100);
  });

  it('a second payment fills what is still missing', async () => {
    const outcome = await record(payment(s.ali, ['2026-10'], 100));
    assert.deepEqual(outcome.parts, [{ month: '2026-10', amount: 100 }]);

    const months = await monthsOf(s.ali, ['2026-10']);
    assert.equal(months['2026-10']!.status, 'paid');
    assert.equal(await owesOf(s.ali), 0);
  });

  it('refuses the same request twice, and saves it once', async () => {
    const input = payment(s.dup, ['2026-10'], 200);
    await record(input);

    const again = await repo.recordPayment(teacherA, input, NOW);
    assert.equal(again.status, 'duplicate-request');

    const count = await one<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM payments WHERE student_id = $1',
      [s.dup]
    );
    assert.equal(count.n, 1);
  });

  it("refuses another teacher's student", async () => {
    const outcome = await repo.recordPayment(teacherA, payment(s.other, ['2026-10'], 200), NOW);
    assert.equal(outcome.status, 'student-not-found');
  });

  it('refuses a month before the student joined, and saves nothing', async () => {
    const outcome = await repo.recordPayment(
      teacherA,
      payment(s.omar, ['2026-09', '2026-10'], 400),
      NOW
    );
    assert.deepEqual(outcome, { status: 'month-before-joining', month: '2026-09' });

    const count = await one<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM payments WHERE student_id = $1',
      [s.omar]
    );
    assert.equal(count.n, 0);
  });

  it('takes a discount into account (50% of 200 = 100 due)', async () => {
    await record(payment(s.sara, ['2026-08', '2026-09'], 200));

    const months = await monthsOf(s.sara, ['2026-08', '2026-09', '2026-10']);
    assert.equal(months['2026-08']!.due, 100);
    assert.equal(months['2026-08']!.status, 'paid');
    assert.equal(months['2026-09']!.status, 'paid');
    assert.equal(months['2026-10']!.status, 'unpaid');
    assert.equal(await owesOf(s.sara), 100);
  });

  it('paying ahead: a future month is not-due until paid, and never owed', async () => {
    const before = await monthsOf(s.ahead, ['2026-11']);
    assert.equal(before['2026-11']!.status, 'not-due');
    assert.equal(before['2026-11']!.not_due_reason, 'future');

    await record(payment(s.ahead, ['2026-10', '2026-11'], 300));

    const months = await monthsOf(s.ahead, ['2026-10', '2026-11']);
    assert.equal(months['2026-10']!.status, 'paid');
    assert.equal(months['2026-11']!.status, 'partly');
    assert.equal(await owesOf(s.ahead), 0);
  });

  it('two payments at the same moment both land where they should (the lock)', async () => {
    // Without the student lock, both would see September unpaid and both
    // would put their 200 there. With it, the second sees the first.
    const [first, second] = await Promise.all([
      repo.recordPayment(teacherA, payment(s.race, ['2026-09', '2026-10'], 200), NOW),
      repo.recordPayment(teacherA, payment(s.race, ['2026-09', '2026-10'], 200), NOW),
    ]);
    assert.equal(first.status, 'recorded');
    assert.equal(second.status, 'recorded');

    const months = await monthsOf(s.race, ['2026-09', '2026-10']);
    assert.equal(months['2026-09']!.paid, 200);
    assert.equal(months['2026-10']!.paid, 200);
  });

  it('a free grade (fee 0): nothing is due', async () => {
    const months = await monthsOf(s.nofee, ['2026-10'], gradeNoFee);
    assert.equal(months['2026-10']!.due, 0);
    assert.equal(months['2026-10']!.status, 'not-due');
    assert.equal(months['2026-10']!.not_due_reason, null);
  });

  it('a month before joining is not-due, with why', async () => {
    const months = await monthsOf(s.omar, ['2026-09']);
    assert.equal(months['2026-09']!.status, 'not-due');
    assert.equal(months['2026-09']!.not_due_reason, 'before-joining');
  });
});

/* ------------------------------ Void a payment ---------------------------- */

describe('voidPayment', () => {
  it('voiding puts every month it covered back to unpaid', async () => {
    const { paymentId } = await record(payment(s.voider, ['2026-08', '2026-09'], 400));

    const outcome = await repo.voidPayment(teacherA, paymentId, 'wrong student');
    assert.deepEqual(outcome, { status: 'voided', studentId: s.voider, gradeId: gradeA });

    const months = await monthsOf(s.voider, ['2026-08', '2026-09']);
    assert.equal(months['2026-08']!.status, 'unpaid');
    assert.equal(months['2026-09']!.status, 'unpaid');

    // The row and its split are still there: voided, not deleted.
    const parts = await repo.findGradePaymentParts(teacherA, gradeA, ['2026-08']);
    const part = parts.find((row) => row.payment_id === paymentId)!;
    assert.equal(part.void_reason, 'wrong student');
    assert.ok(part.voided_on);
  });

  it('voiding twice is refused', async () => {
    const { paymentId } = await record(payment(s.voider, ['2026-10'], 200));
    await repo.voidPayment(teacherA, paymentId, 'typo');

    assert.deepEqual(await repo.voidPayment(teacherA, paymentId, 'again'), {
      status: 'already-voided',
    });
  });

  it("another teacher's payment is not found", async () => {
    const { paymentId } = await record(payment(s.voider, ['2026-10'], 50));
    assert.deepEqual(await repo.voidPayment(teacherB, paymentId, 'x'), { status: 'not-found' });
  });
});

/* ------------------------------ Skip / unskip ----------------------------- */

describe('skipMonth / unskipMonth', () => {
  it('a skipped month is due 0 and never owed', async () => {
    assert.equal(await owesOf(s.skipper), 600);

    const outcome = await repo.skipMonth(teacherA, s.skipper, '2026-09', 'Travelling');
    assert.deepEqual(outcome, { status: 'skipped', gradeId: gradeA });

    const months = await monthsOf(s.skipper, ['2026-09']);
    assert.equal(months['2026-09']!.status, 'skipped');
    assert.equal(months['2026-09']!.due, 0);
    assert.equal(months['2026-09']!.skip_reason, 'Travelling');
    assert.equal(await owesOf(s.skipper), 400);
  });

  it('a skipped month can not be paid', async () => {
    const outcome = await repo.recordPayment(teacherA, payment(s.skipper, ['2026-09'], 200), NOW);
    assert.deepEqual(outcome, { status: 'month-skipped', month: '2026-09' });
  });

  it('undoing a skip makes the month due again', async () => {
    await repo.unskipMonth(teacherA, s.skipper, '2026-09');

    const months = await monthsOf(s.skipper, ['2026-09']);
    assert.equal(months['2026-09']!.status, 'unpaid');
    assert.equal(await owesOf(s.skipper), 600);

    // Nothing left in the row, so the row is gone.
    const row = await one<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM student_months WHERE student_id = $1',
      [s.skipper]
    );
    assert.equal(row.n, 0);
  });

  it('a month with money in it can not be skipped (void first)', async () => {
    const { paymentId } = await record(payment(s.skipper, ['2026-08'], 200));

    assert.deepEqual(await repo.skipMonth(teacherA, s.skipper, '2026-08', 'x'), {
      status: 'month-has-payments',
    });

    await repo.voidPayment(teacherA, paymentId, 'refunded');
    assert.equal((await repo.skipMonth(teacherA, s.skipper, '2026-08', 'x')).status, 'skipped');
  });

  it('a month before joining can not be skipped', async () => {
    assert.deepEqual(await repo.skipMonth(teacherA, s.omar, '2026-09', 'x'), {
      status: 'month-before-joining',
    });
  });

  it("another teacher's student is not found", async () => {
    assert.deepEqual(await repo.skipMonth(teacherA, s.other, '2026-09', 'x'), {
      status: 'student-not-found',
    });
  });
});

/* ---------------------------------- Notes --------------------------------- */

describe('saveMonthNote', () => {
  it('saves, replaces, and keeps a skip when the note is removed', async () => {
    await repo.saveMonthNote(teacherA, s.noter, '2026-10', 'Mom pays on the 15th');
    await repo.saveMonthNote(teacherA, s.noter, '2026-10', 'Mom pays on the 20th');
    await repo.skipMonth(teacherA, s.noter, '2026-10', 'Sick');

    let months = await monthsOf(s.noter, ['2026-10']);
    assert.equal(months['2026-10']!.note, 'Mom pays on the 20th');
    assert.equal(months['2026-10']!.skip_reason, 'Sick');

    await repo.saveMonthNote(teacherA, s.noter, '2026-10', null);
    months = await monthsOf(s.noter, ['2026-10']);
    assert.equal(months['2026-10']!.note, null);
    assert.equal(months['2026-10']!.status, 'skipped');

    await repo.unskipMonth(teacherA, s.noter, '2026-10');
    const row = await one<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM student_months WHERE student_id = $1',
      [s.noter]
    );
    assert.equal(row.n, 0);
  });
});

/* -------------------------------- Overview -------------------------------- */

describe('overview reads', () => {
  it('month totals add up across the grade', async () => {
    const rows = await repo.findGradeStudentMonths(teacherA, gradeA, [NOW], NOW);
    const totals = await repo.findMonthTotals(teacherA, NOW, NOW);

    const due = rows
      .filter((row) => ['paid', 'partly', 'unpaid'].includes(row.status))
      .reduce((sum, row) => sum + row.due, 0);
    const left = rows.reduce((sum, row) => sum + row.left, 0);

    // The no-fee grade adds nothing, so grade A's numbers are the totals.
    assert.equal(totals.expected, due);
    assert.equal(totals.owed, left);
    assert.equal(
      totals.paid + totals.partly + totals.unpaid + totals.skipped,
      rows.filter((row) => row.status !== 'not-due').length
    );
  });

  it('earlier owed counts only months before the one shown', async () => {
    const earlier = await repo.findEarlierOwed(teacherA, NOW, NOW);
    assert.ok(earlier);
    assert.equal(earlier.grade_id, gradeA);

    const upToSeptember = await repo.findGradeOwed(teacherA, gradeA, '2026-09', NOW);
    assert.equal(earlier.students, upToSeptember.length);
    assert.equal(
      earlier.amount,
      upToSeptember.reduce((sum, row) => sum + row.owes, 0)
    );
  });

  it('nobody owes anything before anyone joined', async () => {
    assert.equal(await repo.findEarlierOwed(teacherA, '2026-07', NOW), null);
  });

  it('latest payments: this month only, voided left out, months listed', async () => {
    const latest = await repo.findLatestPayments(teacherA, NOW, 50);

    assert.ok(latest.length > 0);
    assert.ok(latest.every((row) => row.paid_on.startsWith('2026-10')));

    const voided = await one<{ ids: string[] }>(
      `SELECT array_agg(id::text) AS ids FROM payments WHERE voided_at IS NOT NULL AND student_id = ANY ($1::bigint[])`,
      [Object.values(s)]
    );
    assert.ok(latest.every((row) => !voided.ids.includes(row.id)));

    const ali = latest.find((row) => row.student_id === s.ali && row.amount === 500)!;
    assert.deepEqual(ali.months, ['2026-08', '2026-09', '2026-10']);
    assert.equal(ali.grade_id, gradeA);
  });

  it('another teacher sees none of it', async () => {
    assert.equal(await repo.hasAnyPayment(teacherA), true);
    assert.equal(await repo.hasAnyPayment(teacherB), false);
    assert.equal(await repo.findGrade(teacherB, gradeA), null);
    assert.deepEqual(await repo.findGradeStudentMonths(teacherB, gradeA, [NOW], NOW), []);
    assert.deepEqual(await repo.findLatestPayments(teacherB, NOW, 50), []);
  });
});

/* -------------------------------- Clean-up -------------------------------- */

describe('deleting a student', () => {
  it('removes their payments, split and month rows', async () => {
    await pool.query('DELETE FROM students WHERE id = $1', [s.ali]);

    const left = await one<{ n: number }>(
      `
        SELECT
          (SELECT COUNT(*) FROM payments WHERE student_id = $1)
          + (SELECT COUNT(*) FROM student_months WHERE student_id = $1) AS n
      `,
      [s.ali]
    );
    assert.equal(Number(left.n), 0);
  });
});
