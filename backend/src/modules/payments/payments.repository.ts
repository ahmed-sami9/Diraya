import type { PoolClient } from 'pg';

import { pool } from '../../config/db';
import { logActivity } from '../activity/activity.repository';

// Ownership is always checked through the student (payments have no teacher_id).
// Months travel as "YYYY-MM" and are stored as the 1st of the month.

export type IsoMonth = string; // "2026-10"
export type PaymentMethod = 'cash' | 'instapay' | 'vodafone-cash';
export type MonthStatus = 'paid' | 'partly' | 'unpaid' | 'skipped' | 'not-due';
export type NotDueReason = 'before-joining' | 'future';

const toDate = (month: IsoMonth) => `${month}-01`;

/* ------------------------ One student in one month ------------------------ */

// The one place due / paid / left / status are worked out, so every read agrees.
// Exported for the student profile and grade table, which must agree too.
type StudentMonthsParts = { where: string; months: string; currentMonth: string };

export const studentMonthsSql = ({ where, months, currentMonth }: StudentMonthsParts) => `
  SELECT
    s.id AS student_id,
    s.grade_id,
    m.month,
    j.joined_month,
    g.monthly_fee AS fee,
    s.discount_percent,
    x.skip_reason,
    x.note,
    d.due,
    p.paid,
    st.status,
    CASE
      WHEN m.month < j.joined_month THEN 'before-joining'
      WHEN st.status = 'not-due' AND m.month > ${currentMonth} THEN 'future'
    END AS not_due_reason,
    l.left_amount,
    CASE WHEN m.month <= ${currentMonth} THEN l.left_amount ELSE 0 END AS owed
  FROM students s
  JOIN grades g ON g.id = s.grade_id
  CROSS JOIN LATERAL (
    SELECT date_trunc('month', s.created_at AT TIME ZONE 'Africa/Cairo')::date AS joined_month
  ) j
  CROSS JOIN LATERAL (${months}) m (month)
  LEFT JOIN student_months x ON x.student_id = s.id AND x.month = m.month
  CROSS JOIN LATERAL (
    SELECT COALESCE(SUM(pm.amount), 0)::int AS paid
    FROM payment_months pm
    JOIN payments pay ON pay.id = pm.payment_id
    WHERE pay.student_id = s.id AND pm.month = m.month AND pay.voided_at IS NULL
  ) p
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN m.month < j.joined_month OR x.skip_reason IS NOT NULL THEN 0
      ELSE round(g.monthly_fee * (100 - s.discount_percent) / 100.0)::int
    END AS due
  ) d
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN m.month < j.joined_month THEN 'not-due'
      WHEN x.skip_reason IS NOT NULL THEN 'skipped'
      WHEN p.paid = 0 AND (m.month > ${currentMonth} OR d.due = 0) THEN 'not-due'
      WHEN p.paid >= d.due THEN 'paid'
      WHEN p.paid > 0 THEN 'partly'
      ELSE 'unpaid'
    END AS status
  ) st
  CROSS JOIN LATERAL (
    SELECT CASE WHEN st.status IN ('partly', 'unpaid') THEN d.due - p.paid ELSE 0 END AS left_amount
  ) l
  WHERE ${where}
`;

/* ------------------------------ Transactions ------------------------------ */

async function inTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Locks the student so two writes about them can't interleave. The name is
// for recent activity.
async function lockStudent(
  client: PoolClient,
  teacherId: string,
  studentId: string
): Promise<{ grade_id: string; name: string } | null> {
  const result = await client.query<{ grade_id: string; name: string }>(
    `
      SELECT grade_id::text AS grade_id, full_name AS name
      FROM students
      WHERE id = $1 AND teacher_id = $2
      FOR UPDATE
    `,
    [studentId, teacherId]
  );

  return result.rows[0] ?? null;
}

/* ================================== Reads ================================= */

/* ------------------------------- One grade -------------------------------- */

export type PaymentGradeRow = {
  id: string;
  name: string;
  monthly_fee: number;
};

export async function findGrade(
  teacherId: string,
  gradeId: string
): Promise<PaymentGradeRow | null> {
  const result = await pool.query<PaymentGradeRow>(
    `
      SELECT id::text AS id, name, monthly_fee
      FROM grades
      WHERE teacher_id = $1 AND id = $2
    `,
    [teacherId, gradeId]
  );

  return result.rows[0] ?? null;
}

// Ownership is checked by findGrade first.
export async function findGradeGroups(gradeId: string): Promise<{ id: string; name: string }[]> {
  const result = await pool.query<{ id: string; name: string }>(
    `
      SELECT id::text AS id, name
      FROM groups
      WHERE grade_id = $1
      ORDER BY created_at, id
    `,
    [gradeId]
  );

  return result.rows;
}

export type StudentMonthRow = {
  student_id: string;
  full_name: string;
  code: string;
  group_id: string;
  group_name: string;
  discount_percent: number;
  discount_reason: string | null;
  month: IsoMonth;
  fee: number;
  due: number;
  paid: number;
  left: number;
  status: MonthStatus;
  not_due_reason: NotDueReason | null;
  skip_reason: string | null;
  note: string | null;
};

export async function findGradeStudentMonths(
  teacherId: string,
  gradeId: string,
  months: IsoMonth[],
  currentMonth: IsoMonth
): Promise<StudentMonthRow[]> {
  const result = await pool.query<StudentMonthRow>(
    `
      SELECT
        sm.student_id::text AS student_id,
        s.full_name,
        s.code,
        s.group_id::text AS group_id,
        gr.name AS group_name,
        s.discount_percent,
        s.discount_reason,
        to_char(sm.month, 'YYYY-MM') AS month,
        sm.fee,
        sm.due,
        sm.paid,
        sm.left_amount AS left,
        sm.status,
        sm.not_due_reason,
        sm.skip_reason,
        sm.note
      FROM (
        ${studentMonthsSql({
          where: 's.teacher_id = $1 AND s.grade_id = $2',
          months: 'SELECT unnest($3::date[])',
          currentMonth: '$4::date',
        })}
      ) sm
      JOIN students s ON s.id = sm.student_id
      JOIN groups gr ON gr.id = s.group_id
      ORDER BY s.full_name, s.id, sm.month
    `,
    [teacherId, gradeId, months.map(toDate), toDate(currentMonth)]
  );

  return result.rows;
}

export async function findGradeOwed(
  teacherId: string,
  gradeId: string,
  upToMonth: IsoMonth,
  currentMonth: IsoMonth
): Promise<{ student_id: string; owes: number }[]> {
  const result = await pool.query<{ student_id: string; owes: number }>(
    `
      SELECT sm.student_id::text AS student_id, SUM(sm.owed)::int AS owes
      FROM (
        ${studentMonthsSql({
          where: 's.teacher_id = $1 AND s.grade_id = $2',
          months: `SELECT generate_series(j.joined_month, $3::date, interval '1 month')::date`,
          currentMonth: '$4::date',
        })}
      ) sm
      GROUP BY sm.student_id
      HAVING SUM(sm.owed) > 0
    `,
    [teacherId, gradeId, toDate(upToMonth), toDate(currentMonth)]
  );

  return result.rows;
}

// Months older than the grid that each student still owes, oldest first.
// The grid only shows five months; these let an old debt still be paid.
export async function findGradeEarlierOwedMonths(
  teacherId: string,
  gradeId: string,
  beforeMonth: IsoMonth,
  currentMonth: IsoMonth
): Promise<{ student_id: string; month: IsoMonth; left: number }[]> {
  const result = await pool.query<{ student_id: string; month: IsoMonth; left: number }>(
    `
      SELECT sm.student_id::text AS student_id, to_char(sm.month, 'YYYY-MM') AS month, sm.owed AS left
      FROM (
        ${studentMonthsSql({
          where: 's.teacher_id = $1 AND s.grade_id = $2',
          months: `SELECT generate_series(j.joined_month, $3::date - interval '1 month', interval '1 month')::date`,
          currentMonth: '$4::date',
        })}
      ) sm
      WHERE sm.owed > 0
      ORDER BY sm.student_id, sm.month
    `,
    [teacherId, gradeId, toDate(beforeMonth), toDate(currentMonth)]
  );

  return result.rows;
}

export type PaymentPartRow = {
  payment_id: string;
  student_id: string;
  month: IsoMonth;
  part_amount: number; // the share that went to this month
  amount: number;
  paid_on: string;
  method: PaymentMethod;
  note: string | null;
  voided_on: string | null;
  void_reason: string | null;
};

// Voided payments included: the month dialog shows them struck through.
export async function findGradePaymentParts(
  teacherId: string,
  gradeId: string,
  months: IsoMonth[]
): Promise<PaymentPartRow[]> {
  const result = await pool.query<PaymentPartRow>(
    `
      SELECT
        p.id::text AS payment_id,
        p.student_id::text AS student_id,
        to_char(pm.month, 'YYYY-MM') AS month,
        pm.amount AS part_amount,
        p.amount,
        to_char(p.paid_on, 'YYYY-MM-DD') AS paid_on,
        p.method,
        p.note,
        to_char(p.voided_at AT TIME ZONE 'Africa/Cairo', 'YYYY-MM-DD') AS voided_on,
        p.void_reason
      FROM payments p
      JOIN students s ON s.id = p.student_id
      JOIN payment_months pm ON pm.payment_id = p.id
      WHERE s.teacher_id = $1
        AND s.grade_id = $2
        AND pm.month = ANY ($3::date[])
      ORDER BY p.paid_on DESC, p.id DESC
    `,
    [teacherId, gradeId, months.map(toDate)]
  );

  return result.rows;
}

/* -------------------------------- Overview -------------------------------- */

export type MonthTotalsRow = {
  expected: number;
  collected: number;
  owed: number;
  paid: number;
  partly: number;
  unpaid: number;
  skipped: number;
};

export async function findMonthTotals(
  teacherId: string,
  month: IsoMonth,
  currentMonth: IsoMonth
): Promise<MonthTotalsRow> {
  const result = await pool.query<MonthTotalsRow>(
    `
      SELECT
        COALESCE(SUM(sm.due) FILTER (WHERE sm.status IN ('paid', 'partly', 'unpaid')), 0)::int AS expected,
        COALESCE(SUM(sm.paid), 0)::int AS collected,
        COALESCE(SUM(sm.owed), 0)::int AS owed,
        COUNT(*) FILTER (WHERE sm.status = 'paid')::int AS paid,
        COUNT(*) FILTER (WHERE sm.status = 'partly')::int AS partly,
        COUNT(*) FILTER (WHERE sm.status = 'unpaid')::int AS unpaid,
        COUNT(*) FILTER (WHERE sm.status = 'skipped')::int AS skipped
      FROM (
        ${studentMonthsSql({
          where: 's.teacher_id = $1',
          months: 'SELECT $2::date',
          currentMonth: '$3::date',
        })}
      ) sm
    `,
    [teacherId, toDate(month), toDate(currentMonth)]
  );

  return result.rows[0]!;
}

export type EarlierOwedRow = {
  students: number;
  amount: number;
  grade_id: string; // the grade owing the most
};

export async function findEarlierOwed(
  teacherId: string,
  month: IsoMonth,
  currentMonth: IsoMonth
): Promise<EarlierOwedRow | null> {
  const result = await pool.query<EarlierOwedRow>(
    `
      WITH owed AS (
        SELECT sm.student_id, sm.grade_id, SUM(sm.owed) AS amount
        FROM (
          ${studentMonthsSql({
            where: 's.teacher_id = $1',
            months: `SELECT generate_series(j.joined_month, $2::date - interval '1 month', interval '1 month')::date`,
            currentMonth: '$3::date',
          })}
        ) sm
        GROUP BY sm.student_id, sm.grade_id
        HAVING SUM(sm.owed) > 0
      )
      SELECT
        COUNT(*)::int AS students,
        SUM(amount)::int AS amount,
        (
          SELECT grade_id::text
          FROM owed
          GROUP BY grade_id
          ORDER BY SUM(amount) DESC, grade_id
          LIMIT 1
        ) AS grade_id
      FROM owed
      HAVING COUNT(*) > 0
    `,
    [teacherId, toDate(month), toDate(currentMonth)]
  );

  return result.rows[0] ?? null;
}

export async function hasAnyPayment(teacherId: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM payments p
        JOIN students s ON s.id = p.student_id
        WHERE s.teacher_id = $1
      ) AS exists
    `,
    [teacherId]
  );

  return result.rows[0]?.exists ?? false;
}

export type LatestPaymentRow = {
  id: string;
  paid_on: string;
  student_id: string;
  student_name: string;
  grade_id: string;
  grade_name: string;
  months: IsoMonth[];
  method: PaymentMethod;
  amount: number;
};

export async function findLatestPayments(
  teacherId: string,
  month: IsoMonth,
  limit: number
): Promise<LatestPaymentRow[]> {
  const result = await pool.query<LatestPaymentRow>(
    `
      SELECT
        p.id::text AS id,
        to_char(p.paid_on, 'YYYY-MM-DD') AS paid_on,
        s.id::text AS student_id,
        s.full_name AS student_name,
        g.id::text AS grade_id,
        g.name AS grade_name,
        (
          SELECT array_agg(to_char(pm.month, 'YYYY-MM') ORDER BY pm.month)
          FROM payment_months pm
          WHERE pm.payment_id = p.id
        ) AS months,
        p.method,
        p.amount
      FROM payments p
      JOIN students s ON s.id = p.student_id
      JOIN grades g ON g.id = s.grade_id
      WHERE s.teacher_id = $1
        AND p.voided_at IS NULL
        AND p.paid_on >= $2::date
        AND p.paid_on < $2::date + interval '1 month'
      ORDER BY p.paid_on DESC, p.id DESC
      LIMIT $3
    `,
    [teacherId, toDate(month), limit]
  );

  return result.rows;
}

/* ================================= Writes ================================= */

/* ----------------------------- Record a payment ---------------------------- */

export type RecordPaymentInput = {
  requestId: string;
  studentId: string;
  months: IsoMonth[];
  amount: number;
  paidOn: string;
  method: PaymentMethod;
  note: string | null;
};

export type PaymentPart = { month: IsoMonth; amount: number };

export type RecordPaymentOutcome =
  | { status: 'recorded'; paymentId: string; gradeId: string; parts: PaymentPart[] }
  | { status: 'student-not-found' }
  | { status: 'month-before-joining'; month: IsoMonth }
  | { status: 'month-skipped'; month: IsoMonth }
  | { status: 'duplicate-request'; gradeId: string };

// Oldest month first; the last month takes the remainder, so an overpayment is kept.
export function splitAmount(
  months: { month: IsoMonth; needs: number }[],
  amount: number
): PaymentPart[] {
  const ordered = [...months].sort((a, b) => a.month.localeCompare(b.month));
  let remaining = amount;

  return ordered
    .map((item, index) => {
      const part = index === ordered.length - 1 ? remaining : Math.min(item.needs, remaining);
      remaining -= part;
      return { month: item.month, amount: part };
    })
    .filter((part) => part.amount > 0);
}

export async function recordPayment(
  teacherId: string,
  input: RecordPaymentInput,
  currentMonth: IsoMonth
): Promise<RecordPaymentOutcome> {
  return inTransaction(async (client) => {
    const student = await lockStudent(client, teacherId, input.studentId);
    if (!student) return { status: 'student-not-found' };

    const standing = await client.query<{
      month: IsoMonth;
      before_joining: boolean;
      skipped: boolean;
      needs: number;
    }>(
      `
        SELECT
          to_char(sm.month, 'YYYY-MM') AS month,
          sm.month < sm.joined_month AS before_joining,
          sm.skip_reason IS NOT NULL AS skipped,
          GREATEST(sm.due - sm.paid, 0) AS needs
        FROM (
          ${studentMonthsSql({
            where: 's.id = $1',
            months: 'SELECT unnest($2::date[])',
            currentMonth: '$3::date',
          })}
        ) sm
        ORDER BY sm.month
      `,
      [input.studentId, input.months.map(toDate), toDate(currentMonth)]
    );

    const beforeJoining = standing.rows.find((row) => row.before_joining);
    if (beforeJoining) return { status: 'month-before-joining', month: beforeJoining.month };

    const skipped = standing.rows.find((row) => row.skipped);
    if (skipped) return { status: 'month-skipped', month: skipped.month };

    const parts = splitAmount(standing.rows, input.amount);

    // A repeated request_id inserts nothing: a double click is ignored.
    const inserted = await client.query<{ id: string }>(
      `
        INSERT INTO payments (student_id, amount, paid_on, method, note, request_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (request_id) DO NOTHING
        RETURNING id::text AS id
      `,
      [input.studentId, input.amount, input.paidOn, input.method, input.note, input.requestId]
    );

    const payment = inserted.rows[0];
    if (!payment) return { status: 'duplicate-request', gradeId: student.grade_id };

    await client.query(
      `
        INSERT INTO payment_months (payment_id, month, amount)
        SELECT $1, x.month, x.amount
        FROM unnest($2::date[], $3::int[]) AS x (month, amount)
      `,
      [payment.id, parts.map((part) => toDate(part.month)), parts.map((part) => part.amount)]
    );

    // Recent activity, saved with the payment. A repeated request returned
    // above, so a double click is never logged twice.
    await logActivity(client, teacherId, 'payment.recorded', {
      studentId: input.studentId,
      studentName: student.name,
      amount: input.amount,
      months: parts.map((part) => part.month),
    });

    return { status: 'recorded', paymentId: payment.id, gradeId: student.grade_id, parts };
  });
}

/* ----------------------------- Void a payment ----------------------------- */

export type VoidPaymentOutcome =
  | { status: 'voided'; studentId: string; gradeId: string }
  | { status: 'not-found' }
  | { status: 'already-voided' };

// A transaction now, so the void and its recent-activity entry are saved
// together or not at all.
export async function voidPayment(
  teacherId: string,
  paymentId: string,
  reason: string
): Promise<VoidPaymentOutcome> {
  return inTransaction(async (client) => {
    // "voided_at IS NULL" lets only one of two simultaneous voids succeed.
    const updated = await client.query<{
      student_id: string;
      grade_id: string;
      student_name: string;
      amount: number;
    }>(
      `
        UPDATE payments p
        SET voided_at = CURRENT_TIMESTAMP, void_reason = $3
        FROM students s
        WHERE p.id = $2
          AND s.id = p.student_id
          AND s.teacher_id = $1
          AND p.voided_at IS NULL
        RETURNING s.id::text AS student_id, s.grade_id::text AS grade_id,
                  s.full_name AS student_name, p.amount
      `,
      [teacherId, paymentId, reason]
    );

    const row = updated.rows[0];

    if (row) {
      await logActivity(client, teacherId, 'payment.voided', {
        studentId: row.student_id,
        studentName: row.student_name,
        amount: row.amount,
        reason,
      });

      return { status: 'voided', studentId: row.student_id, gradeId: row.grade_id };
    }

    const existing = await client.query(
      `
        SELECT 1
        FROM payments p
        JOIN students s ON s.id = p.student_id
        WHERE p.id = $2 AND s.teacher_id = $1
      `,
      [teacherId, paymentId]
    );

    return existing.rowCount ? { status: 'already-voided' } : { status: 'not-found' };
  });
}

/* ---------------------------- Skip / unskip ------------------------------- */

export type SkipMonthOutcome =
  | { status: 'skipped'; gradeId: string }
  | { status: 'student-not-found' }
  | { status: 'month-before-joining' }
  | { status: 'month-has-payments' };

// A month with live payments can't be skipped: void them first.
export async function skipMonth(
  teacherId: string,
  studentId: string,
  month: IsoMonth,
  reason: string
): Promise<SkipMonthOutcome> {
  return inTransaction(async (client) => {
    const student = await lockStudent(client, teacherId, studentId);
    if (!student) return { status: 'student-not-found' };

    const check = await client.query<{ before_joining: boolean; has_payments: boolean }>(
      `
        SELECT
          $2::date < date_trunc('month', s.created_at AT TIME ZONE 'Africa/Cairo')::date
            AS before_joining,
          EXISTS (
            SELECT 1
            FROM payments p
            JOIN payment_months pm ON pm.payment_id = p.id
            WHERE p.student_id = s.id AND pm.month = $2::date AND p.voided_at IS NULL
          ) AS has_payments
        FROM students s
        WHERE s.id = $1
      `,
      [studentId, toDate(month)]
    );

    const row = check.rows[0]!;
    if (row.before_joining) return { status: 'month-before-joining' };
    if (row.has_payments) return { status: 'month-has-payments' };

    await client.query(
      `
        INSERT INTO student_months (student_id, month, skip_reason)
        VALUES ($1, $2, $3)
        ON CONFLICT (student_id, month) DO UPDATE
        SET skip_reason = EXCLUDED.skip_reason, updated_at = CURRENT_TIMESTAMP
      `,
      [studentId, toDate(month), reason]
    );

    return { status: 'skipped', gradeId: student.grade_id };
  });
}

// Deletes the row once it's empty: no row means a normal month.
async function clearMonthField(
  client: PoolClient,
  studentId: string,
  month: IsoMonth,
  field: 'skip_reason' | 'note'
) {
  // Safe to interpolate: `field` is a fixed name, never user input.
  await client.query(
    `
      UPDATE student_months
      SET ${field} = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE student_id = $1 AND month = $2
        AND (skip_reason IS NOT NULL AND note IS NOT NULL)
    `,
    [studentId, toDate(month)]
  );

  await client.query(
    `
      DELETE FROM student_months
      WHERE student_id = $1 AND month = $2
        AND ${field === 'skip_reason' ? 'note' : 'skip_reason'} IS NULL
    `,
    [studentId, toDate(month)]
  );
}

export type StudentMonthOutcome =
  | { status: 'saved'; gradeId: string }
  | { status: 'student-not-found' };

export async function unskipMonth(
  teacherId: string,
  studentId: string,
  month: IsoMonth
): Promise<StudentMonthOutcome> {
  return inTransaction(async (client) => {
    const student = await lockStudent(client, teacherId, studentId);
    if (!student) return { status: 'student-not-found' };

    await clearMonthField(client, studentId, month, 'skip_reason');

    return { status: 'saved', gradeId: student.grade_id };
  });
}

/* ---------------------------------- Note ---------------------------------- */

// null removes the note.
export async function saveMonthNote(
  teacherId: string,
  studentId: string,
  month: IsoMonth,
  text: string | null
): Promise<StudentMonthOutcome> {
  return inTransaction(async (client) => {
    const student = await lockStudent(client, teacherId, studentId);
    if (!student) return { status: 'student-not-found' };

    if (text === null) {
      await clearMonthField(client, studentId, month, 'note');
    } else {
      await client.query(
        `
          INSERT INTO student_months (student_id, month, note)
          VALUES ($1, $2, $3)
          ON CONFLICT (student_id, month) DO UPDATE
          SET note = EXCLUDED.note, updated_at = CURRENT_TIMESTAMP
        `,
        [studentId, toDate(month), text]
      );
    }

    return { status: 'saved', gradeId: student.grade_id };
  });
}
