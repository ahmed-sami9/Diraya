import { currentMonthInCairo } from '../../utils/cairoDate';

import { GradeErrors } from '../grades/grades.errors';

import {
  findEarlierOwed,
  findGrade,
  findGradeGroups,
  findGradeOwed,
  findGradePaymentParts,
  findGradeStudentMonths,
  findLatestPayments,
  findMonthTotals,
  hasAnyPayment,
  type IsoMonth,
  type MonthStatus,
  type NotDueReason,
  type PaymentMethod,
  type PaymentPartRow,
  type StudentMonthRow,
} from './payments.repository';

// Must match frontend/src/api/payments/payments.ts field for field.

/* ---------------------------------- Types --------------------------------- */

export type PaymentsOverview = {
  month: IsoMonth;
  hasAnyPayment: boolean;
  totals: {
    expected: number;
    collected: number;
    owed: number;
    students: { paid: number; partly: number; unpaid: number; skipped: number };
  };
  earlierOwed: { students: number; amount: number; gradeId: string | null } | null;
  latest: {
    id: string;
    paidOn: string;
    student: { id: string; name: string };
    grade: { id: string; name: string };
    months: IsoMonth[];
    method: PaymentMethod;
    amount: number;
  }[];
};

export type Payment = {
  id: string;
  amount: number; // the share that went to this month
  paidOn: string;
  method: PaymentMethod;
  note: string | null;
  voided: { on: string; reason: string } | null;
};

export type StudentMonth = {
  month: IsoMonth;
  gradeFee: number;
  discountPercent: number;
  due: number;
  paid: number;
  left: number;
  status: MonthStatus;
  notDueReason: NotDueReason | null;
  payments: Payment[];
  skipReason: string | null;
  note: string | null;
};

export type PaymentStudent = {
  id: string;
  name: string;
  code: string;
  groupId: string;
  discountPercent: number;
  discountReason: string | null;
};

export type GradePayments = {
  grade: { id: string; name: string; fee: number };
  groups: { id: string; name: string }[];
  month: IsoMonth;
  months: IsoMonth[];
  students: {
    student: PaymentStudent;
    groupName: string;
    cells: StudentMonth[];
    selected: StudentMonth;
    owes: number;
  }[];
  totals: { expected: number; collected: number; owed: number; unpaid: number; partly: number };
};

/* --------------------------------- Months --------------------------------- */

export function addMonths(month: IsoMonth, count: number): IsoMonth {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(year, monthNumber - 1 + count, 1)).toISOString().slice(0, 7);
}

// Three months back for context, one ahead for paying in advance.
const WINDOW = [-3, -2, -1, 0, 1];

const LATEST_LIMIT = 20;

/* -------------------------------- Overview -------------------------------- */

export async function getPaymentsOverview(
  teacherId: string,
  month: IsoMonth
): Promise<PaymentsOverview> {
  const now = currentMonthInCairo();

  const [totals, earlier, anyPayment, latest] = await Promise.all([
    findMonthTotals(teacherId, month, now),
    findEarlierOwed(teacherId, month, now),
    hasAnyPayment(teacherId),
    findLatestPayments(teacherId, month, LATEST_LIMIT),
  ]);

  return {
    month,
    hasAnyPayment: anyPayment,
    totals: {
      expected: totals.expected,
      collected: totals.collected,
      owed: totals.owed,
      students: {
        paid: totals.paid,
        partly: totals.partly,
        unpaid: totals.unpaid,
        skipped: totals.skipped,
      },
    },
    earlierOwed: earlier
      ? { students: earlier.students, amount: earlier.amount, gradeId: earlier.grade_id }
      : null,
    latest: latest.map((row) => ({
      id: row.id,
      paidOn: row.paid_on,
      student: { id: row.student_id, name: row.student_name },
      grade: { id: row.grade_id, name: row.grade_name },
      months: row.months,
      method: row.method,
      amount: row.amount,
    })),
  };
}

/* ------------------------------- One grade -------------------------------- */

// Also what every write answers with, so the screen always shows the server's truth.
export async function getGradePayments(
  teacherId: string,
  gradeId: string,
  month: IsoMonth
): Promise<GradePayments> {
  const grade = await findGrade(teacherId, gradeId);
  if (!grade) throw GradeErrors.notFound();

  const now = currentMonthInCairo();
  const months = WINDOW.map((offset) => addMonths(month, offset));

  const [groups, rows, owed, parts] = await Promise.all([
    findGradeGroups(gradeId),
    findGradeStudentMonths(teacherId, gradeId, months, now),
    findGradeOwed(teacherId, gradeId, month, now),
    findGradePaymentParts(teacherId, gradeId, months),
  ]);

  const owesByStudent = new Map(owed.map((row) => [row.student_id, row.owes]));
  const paymentsByCell = groupPayments(parts);

  // Rows come sorted by name then month; a Map keeps that order.
  const byStudent = new Map<string, StudentMonthRow[]>();
  for (const row of rows) {
    const list = byStudent.get(row.student_id) ?? [];
    list.push(row);
    byStudent.set(row.student_id, list);
  }

  const students = [...byStudent.values()].map((studentRows) => {
    const first = studentRows[0]!;
    const cells = studentRows.map((row) =>
      toStudentMonth(row, paymentsByCell.get(cellKey(row.student_id, row.month)) ?? [])
    );

    return {
      student: {
        id: first.student_id,
        name: first.full_name,
        code: first.code,
        groupId: first.group_id,
        discountPercent: first.discount_percent,
        discountReason: first.discount_reason,
      },
      groupName: first.group_name,
      cells,
      selected: cells.find((cell) => cell.month === month)!,
      owes: owesByStudent.get(first.student_id) ?? 0,
    };
  });

  const selected = students.map((row) => row.selected);
  const counted = selected.filter((cell) => ['paid', 'partly', 'unpaid'].includes(cell.status));

  return {
    grade: { id: grade.id, name: grade.name, fee: grade.monthly_fee ?? 0 },
    groups,
    month,
    months,
    students,
    totals: {
      expected: sum(counted.map((cell) => cell.due)),
      collected: sum(selected.map((cell) => cell.paid)),
      owed: sum(selected.map((cell) => cell.left)),
      unpaid: selected.filter((cell) => cell.status === 'unpaid').length,
      partly: selected.filter((cell) => cell.status === 'partly').length,
    },
  };
}

/* --------------------------------- Helpers -------------------------------- */

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

const cellKey = (studentId: string, month: IsoMonth) => `${studentId}:${month}`;

function groupPayments(parts: PaymentPartRow[]): Map<string, Payment[]> {
  const byCell = new Map<string, Payment[]>();

  for (const part of parts) {
    const key = cellKey(part.student_id, part.month);
    const list = byCell.get(key) ?? [];
    list.push({
      id: part.payment_id,
      amount: part.part_amount,
      paidOn: part.paid_on,
      method: part.method,
      note: part.note,
      voided:
        part.voided_on && part.void_reason
          ? { on: part.voided_on, reason: part.void_reason }
          : null,
    });
    byCell.set(key, list);
  }

  return byCell;
}

function toStudentMonth(row: StudentMonthRow, payments: Payment[]): StudentMonth {
  return {
    month: row.month,
    gradeFee: row.fee,
    discountPercent: row.discount_percent,
    due: row.due,
    paid: row.paid,
    left: row.left,
    status: row.status,
    notDueReason: row.not_due_reason,
    payments,
    skipReason: row.skip_reason,
    note: row.note,
  };
}
