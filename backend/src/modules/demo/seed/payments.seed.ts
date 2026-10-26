import { randomUUID } from 'node:crypto';

import { todayInCairo } from '../../../utils/cairoDate';
import { splitAmount, type IsoMonth } from '../../payments/payments.repository';
import { addMonths } from '../../payments/payments.service';

import type { DemoSeeder } from './demo.seed.types';
import { pick } from './demo.seed.helpers';
import { DEMO_GRADES } from './grades.seed';
import { DEMO_STUDENTS, joinedOn } from './students.seed';

type Method = 'cash' | 'instapay' | 'vodafone-cash';

// Mostly cash, like most private lessons in Egypt.
const METHODS: readonly Method[] = ['cash', 'cash', 'instapay', 'cash', 'vodafone-cash'];

// Everyone else pays each month on time. These students give the Payments
// page something to show (see students.seed.ts for their personas):
const STORIES: Record<string, Story> = {
  // Owes last month AND this month: the "earlier months still owed" banner.
  'Adam Mostafa': {
    unpaidMonthsAgo: [1, 0],
    monthNote: 'Father will pay both months together at the end of the month.',
  },
  // Paid part of this month.
  'Karim Adel': { partlyThisMonth: 0.5 },
  'Lojain Fathy': { partlyThisMonth: 0.4 },
  // Hasn't paid this month yet.
  'Seif Hossam': { unpaidMonthsAgo: [0] },
  'Mohamed Nabil': { unpaidMonthsAgo: [0] },
  'Eyad Hany': { unpaidMonthsAgo: [0] },
  // Away for a month: skipped, so nothing is due for it.
  'Ziad Reda': { skippedMonthsAgo: 2, skipReason: 'Travelled with family' },
  // Pays two months in one go, and paid next month in advance.
  'Youssef Ahmed': { paysTwoMonthsAtOnce: true, paysNextMonth: true },
  // A payment recorded twice by mistake: the copy is voided, never deleted.
  'Nour Ibrahim': { voidedDuplicateMonthsAgo: 1 },
};

type Story = {
  unpaidMonthsAgo?: number[];
  partlyThisMonth?: number;
  skippedMonthsAgo?: number;
  skipReason?: string;
  monthNote?: string;
  paysTwoMonthsAtOnce?: boolean;
  paysNextMonth?: boolean;
  voidedDuplicateMonthsAgo?: number;
};

type PlannedPayment = {
  studentIndex: number;
  paidOn: string;
  method: Method;
  parts: { month: IsoMonth; amount: number }[];
  voidReason: string | null;
};

type PlannedMonth = {
  studentIndex: number;
  month: IsoMonth;
  skipReason: string | null;
  note: string | null;
};

// The same rule the payments queries use: fee minus the student's discount, rounded.
const dueFor = (fee: number, discountPercent: number) =>
  Math.round((fee * (100 - discountPercent)) / 100);

// Each student pays on "their" day of the month (1st-10th), never before
// joining and never after today.
function paidOnFor(month: IsoMonth, studentIndex: number, joined: string, today: string): string {
  const day = `${month}-${String(1 + ((studentIndex * 3) % 10)).padStart(2, '0')}`;
  const notBeforeJoining = day < joined ? joined : day;
  return notBeforeJoining > today ? today : notBeforeJoining;
}

function plan(): { payments: PlannedPayment[]; months: PlannedMonth[] } {
  const today = todayInCairo();
  const thisMonth = today.slice(0, 7);
  const monthsAgo = (count: number) => addMonths(thisMonth, -count);
  const payments: PlannedPayment[] = [];
  const months: PlannedMonth[] = [];

  DEMO_STUDENTS.forEach((student, studentIndex) => {
    const story = STORIES[student.name] ?? {};
    const joined = joinedOn(student);
    const fee = DEMO_GRADES[student.gradeIndex]!.monthlyFee;
    const due = dueFor(fee, student.discount?.percent ?? 0);
    const method = pick(METHODS, studentIndex);

    const skipped = story.skippedMonthsAgo === undefined ? null : monthsAgo(story.skippedMonthsAgo);
    if (skipped && story.skipReason) {
      months.push({ studentIndex, month: skipped, skipReason: story.skipReason, note: null });
    }
    if (story.monthNote) {
      months.push({ studentIndex, month: thisMonth, skipReason: null, note: story.monthNote });
    }

    // Every month from joining to this one that should have a payment.
    const owed: IsoMonth[] = [];
    for (let month = joined.slice(0, 7); month <= thisMonth; month = addMonths(month, 1)) {
      if (month === skipped) continue;
      if (story.unpaidMonthsAgo?.some((count) => monthsAgo(count) === month)) continue;
      owed.push(month);
    }

    const pay = (paidMonths: IsoMonth[], amount: number, voidReason: string | null = null) => {
      // The real split: oldest month first, the last one takes any extra.
      const parts = splitAmount(
        paidMonths.map((month) => ({ month, needs: due })),
        amount
      );
      payments.push({
        studentIndex,
        paidOn: paidOnFor(paidMonths[0]!, studentIndex, joined, today),
        method,
        parts,
        voidReason,
      });
    };

    for (let i = 0; i < owed.length; i++) {
      const month = owed[i]!;
      const next = owed[i + 1];

      if (story.paysTwoMonthsAtOnce && next && i % 2 === 0) {
        pay([month, next], due * 2);
        i++;
        continue;
      }

      if (month === thisMonth && story.partlyThisMonth) {
        pay([month], Math.round(due * story.partlyThisMonth));
        continue;
      }

      pay([month], due);

      if (
        story.voidedDuplicateMonthsAgo !== undefined &&
        month === monthsAgo(story.voidedDuplicateMonthsAgo)
      ) {
        pay([month], due, 'Recorded twice by mistake');
      }
    }

    if (story.paysNextMonth) pay([addMonths(thisMonth, 1)], due);
  });

  return { payments, months };
}

export const paymentsSeeder: DemoSeeder = {
  name: 'payments',

  async run({ client, created }) {
    const { students } = created;

    if (!students) throw new Error('The payments seeder needs the students seeder to run first.');

    const { payments, months } = plan();
    const requestIds = payments.map(() => randomUUID());

    // Entered the evening it was paid (never in the future); a voided copy is
    // caught five minutes later.
    const inserted = await client.query<{ id: string; request_id: string }>(
      `
        INSERT INTO payments (student_id, amount, paid_on, method, request_id, created_at, voided_at, void_reason)
        SELECT p.student_id, p.amount, p.paid_on, p.method, p.request_id, entered.at,
               CASE WHEN p.void_reason IS NULL THEN NULL ELSE entered.at + INTERVAL '5 minutes' END,
               p.void_reason
        FROM unnest($1::bigint[], $2::int[], $3::date[], $4::text[], $5::uuid[], $6::text[])
          AS p(student_id, amount, paid_on, method, request_id, void_reason)
        CROSS JOIN LATERAL (
          SELECT LEAST(NOW(), (p.paid_on + TIME '18:00') AT TIME ZONE 'Africa/Cairo') AS at
        ) entered
        RETURNING id::text, request_id::text
      `,
      [
        payments.map((payment) => students[payment.studentIndex]!),
        payments.map((payment) => payment.parts.reduce((sum, part) => sum + part.amount, 0)),
        payments.map((payment) => payment.paidOn),
        payments.map((payment) => payment.method),
        requestIds,
        payments.map((payment) => payment.voidReason),
      ]
    );

    // request_id is unique, so it identifies each new payment.
    const paymentId = new Map(inserted.rows.map((row) => [row.request_id, row.id]));
    const parts = payments.flatMap((payment, index) =>
      payment.parts.map((part) => ({ paymentId: paymentId.get(requestIds[index]!)!, ...part }))
    );

    await client.query(
      `
        INSERT INTO payment_months (payment_id, month, amount)
        SELECT x.payment_id, x.month, x.amount
        FROM unnest($1::bigint[], $2::date[], $3::int[]) AS x(payment_id, month, amount)
      `,
      [
        parts.map((part) => part.paymentId),
        parts.map((part) => `${part.month}-01`),
        parts.map((part) => part.amount),
      ]
    );

    if (months.length > 0) {
      await client.query(
        `
          INSERT INTO student_months (student_id, month, skip_reason, note)
          SELECT m.student_id, m.month, m.skip_reason, m.note
          FROM unnest($1::bigint[], $2::date[], $3::text[], $4::text[])
            AS m(student_id, month, skip_reason, note)
        `,
        [
          months.map((month) => students[month.studentIndex]!),
          months.map((month) => `${month.month}-01`),
          months.map((month) => month.skipReason),
          months.map((month) => month.note),
        ]
      );
    }
  },
};
