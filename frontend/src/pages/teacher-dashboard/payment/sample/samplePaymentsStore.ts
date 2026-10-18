import { useSyncExternalStore } from 'react';

import { todayInCairo } from '../../../../utils/cairoDate';
import type { PaymentMethod, PaymentsOverview } from '../PaymentsPage';
import { addMonths, currentMonth, type IsoMonth, type MonthStatus } from '../paymentsHelpers';

export type { MonthStatus };

// ============================================================================
// TEMPORARY: a fake payments "backend" that lives in the browser, so every
// payments screen can be clicked through before the real API exists.
//
//   - sample grades, students, payments, discounts and skipped months
//   - the RULES (what a month costs, what's paid, what's owed) as pure
//     functions: exactly what the server will compute in SQL later, so this
//     file doubles as the spec for the backend
//   - a tiny store, so a payment recorded on one page shows on the others
//
// Nothing is saved: a page refresh starts over. When the API is built, the
// pages swap usePaymentsSample() for real hooks and this folder is deleted.
// ============================================================================

/* ---------------------------------- Types --------------------------------- */

export type SampleGrade = {
  id: string;
  name: string;
  // The fee history: each entry applies from its month until the next one.
  // A fee change never rewrites the past.
  fees: { from: IsoMonth; fee: number }[];
  groups: { id: string; name: string }[];
};

export type SampleStudent = {
  id: string;
  name: string;
  code: string;
  gradeId: string;
  groupId: string;
  // Owes from this month on (the month they joined).
  joinedMonth: IsoMonth;
  // A standing discount, e.g. 50 for twins. 0 = none.
  discountPercent: number;
  discountReason: string | null;
};

export type SamplePayment = {
  id: string;
  // One "Record payment" can cover several months: one row per month, all
  // with the same recordId so they can be shown together.
  recordId: string;
  studentId: string;
  month: IsoMonth;
  amount: number;
  paidOn: string; // "YYYY-MM-DD"
  method: PaymentMethod;
  note: string | null;
  // Payments are never deleted, only voided (with why).
  voided: { on: string; reason: string } | null;
};

type Waiver = { studentId: string; month: IsoMonth; reason: string };
type MonthNote = { studentId: string; month: IsoMonth; text: string };

type State = {
  grades: SampleGrade[];
  students: SampleStudent[];
  payments: SamplePayment[];
  waivers: Waiver[];
  notes: MonthNote[];
};

// One student in one month: everything the grid cell and the dialog show.
export type StudentMonth = {
  studentId: string;
  month: IsoMonth;
  gradeFee: number;
  discountPercent: number;
  due: number;
  paid: number;
  left: number;
  status: MonthStatus;
  // Why it isn't due ("joined later", "not yet"), for the cell's label.
  notDueReason: 'before-joining' | 'future' | null;
  payments: SamplePayment[]; // voided ones included, newest first
  skipReason: string | null;
  note: string | null;
};

/* ---------------------------------- Rules --------------------------------- */
// The server will do exactly this. Keep the two in step.

export function feeFor(grade: SampleGrade, month: IsoMonth): number {
  // The latest fee entry that started on or before this month.
  let fee = 0;
  for (const entry of grade.fees) if (entry.from <= month) fee = entry.fee;
  return fee;
}

// Whole pounds: a 50% discount on 325 is 163, never 162.5.
const applyDiscount = (fee: number, percent: number) => Math.round((fee * (100 - percent)) / 100);

export function studentMonth(state: State, student: SampleStudent, month: IsoMonth): StudentMonth {
  const grade = state.grades.find((item) => item.id === student.gradeId)!;
  const gradeFee = feeFor(grade, month);
  const payments = state.payments
    .filter((p) => p.studentId === student.id && p.month === month)
    .sort((a, b) => b.paidOn.localeCompare(a.paidOn) || b.id.localeCompare(a.id));
  const paid = payments.filter((p) => !p.voided).reduce((sum, p) => sum + p.amount, 0);
  const waiver = state.waivers.find((w) => w.studentId === student.id && w.month === month);
  const note =
    state.notes.find((n) => n.studentId === student.id && n.month === month)?.text ?? null;

  const base = {
    studentId: student.id,
    month,
    gradeFee,
    discountPercent: student.discountPercent,
    payments,
    skipReason: waiver?.reason ?? null,
    note,
  };

  if (month < student.joinedMonth) {
    return { ...base, due: 0, paid, left: 0, status: 'not-due', notDueReason: 'before-joining' };
  }

  if (waiver) {
    return { ...base, due: 0, paid, left: 0, status: 'skipped', notDueReason: null };
  }

  const due = applyDiscount(gradeFee, student.discountPercent);

  // A future month isn't owed yet, unless someone paid ahead for it.
  if (month > currentMonth() && paid === 0) {
    return { ...base, due, paid, left: 0, status: 'not-due', notDueReason: 'future' };
  }

  const left = Math.max(0, due - paid);
  const status: MonthStatus = left === 0 ? 'paid' : paid > 0 ? 'partly' : 'unpaid';

  return { ...base, due, paid, left, status, notDueReason: null };
}

// Everything still owed before `month` (from joining; skipped months owe 0).
export function owedBefore(state: State, student: SampleStudent, month: IsoMonth): number {
  let total = 0;
  for (let m = student.joinedMonth; m < month; m = addMonths(m, 1)) {
    total += studentMonth(state, student, m).left;
  }
  return total;
}

/* --------------------------------- Views ---------------------------------- */
// The shapes the API will answer with.

export function overviewFor(
  state: State,
  month: IsoMonth,
  gradeId: string | null
): PaymentsOverview {
  const grades = state.grades.filter((g) => !gradeId || g.id === gradeId);
  const counts = { paid: 0, partly: 0, unpaid: 0, skipped: 0 };
  let expected = 0;
  let collected = 0;
  let earlierStudents = 0;
  let earlierAmount = 0;
  let earlierGradeId: string | null = null;

  const gradeRows = grades.map((grade) => {
    const students = state.students.filter((s) => s.gradeId === grade.id);
    let gExpected = 0;
    let gCollected = 0;
    let gOwed = 0;
    let gStudents = 0;

    for (const student of students) {
      const sm = studentMonth(state, student, month);
      if (sm.status === 'not-due') continue;
      gStudents += 1;
      if (sm.status === 'skipped') counts.skipped += 1;
      else if (sm.status === 'paid') counts.paid += 1;
      else if (sm.status === 'partly') counts.partly += 1;
      else counts.unpaid += 1;
      gExpected += sm.due;
      gCollected += Math.min(sm.paid, sm.due);
      gOwed += sm.left;

      const before = owedBefore(state, student, month);
      if (before > 0) {
        earlierStudents += 1;
        earlierAmount += before;
        earlierGradeId ??= grade.id;
      }
    }

    expected += gExpected;
    collected += gCollected;

    return {
      id: grade.id,
      name: grade.name,
      monthlyFee: feeFor(grade, month),
      studentCount: gStudents,
      expected: gExpected,
      collected: gCollected,
      owed: gOwed,
    };
  });

  // This month's payments, newest first, one row per "Record payment".
  const studentIds = new Set(
    state.students.filter((s) => grades.some((g) => g.id === s.gradeId)).map((s) => s.id)
  );
  const records = new Map<string, PaymentsOverview['latest'][number]>();
  for (const p of state.payments) {
    if (p.voided || !p.paidOn.startsWith(month) || !studentIds.has(p.studentId)) continue;
    const existing = records.get(p.recordId);
    if (existing) {
      existing.amount += p.amount;
      existing.months.push(p.month);
      continue;
    }
    const student = state.students.find((s) => s.id === p.studentId)!;
    const grade = state.grades.find((g) => g.id === student.gradeId)!;
    records.set(p.recordId, {
      id: p.recordId,
      paidOn: p.paidOn,
      student: { id: student.id, name: student.name },
      grade: { id: grade.id, name: grade.name },
      months: [p.month],
      method: p.method,
      amount: p.amount,
    });
  }

  return {
    month,
    hasAnyPayment: state.payments.length > 0,
    totals: { expected, collected, owed: expected - collected, students: counts },
    earlierOwed:
      earlierStudents > 0
        ? { students: earlierStudents, amount: earlierAmount, gradeId: earlierGradeId }
        : null,
    grades: gradeRows,
    latest: [...records.values()]
      .sort((a, b) => b.paidOn.localeCompare(a.paidOn) || b.id.localeCompare(a.id))
      .slice(0, 8),
  };
}

export type GradePayments = {
  grade: { id: string; name: string; fee: number; feeSince: IsoMonth };
  groups: { id: string; name: string }[];
  months: IsoMonth[];
  month: IsoMonth;
  students: {
    student: SampleStudent;
    groupName: string;
    cells: StudentMonth[]; // one per `months`
    selected: StudentMonth; // the selected month
    owes: number; // everything still owed up to this month
  }[];
  totals: { expected: number; collected: number; owed: number; unpaid: number; partly: number };
};

// One grade around `month`: three months before it, it, and one after.
export function gradePaymentsFor(
  state: State,
  gradeId: string,
  month: IsoMonth
): GradePayments | null {
  const grade = state.grades.find((g) => g.id === gradeId);
  if (!grade) return null;

  const months = [-3, -2, -1, 0, 1].map((offset) => addMonths(month, offset));
  const totals = { expected: 0, collected: 0, owed: 0, unpaid: 0, partly: 0 };

  const students = state.students
    .filter((s) => s.gradeId === gradeId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((student) => {
      const selected = studentMonth(state, student, month);
      if (selected.status !== 'not-due' && selected.status !== 'skipped') {
        totals.expected += selected.due;
        totals.collected += Math.min(selected.paid, selected.due);
        totals.owed += selected.left;
        if (selected.status === 'unpaid') totals.unpaid += 1;
        if (selected.status === 'partly') totals.partly += 1;
      }
      return {
        student,
        groupName: grade.groups.find((g) => g.id === student.groupId)?.name ?? '',
        cells: months.map((m) => studentMonth(state, student, m)),
        selected,
        owes: owedBefore(state, student, addMonths(month, 1)),
      };
    });

  const feeSince = [...grade.fees].reverse().find((f) => f.from <= month)?.from ?? month;

  return {
    grade: { id: grade.id, name: grade.name, fee: feeFor(grade, month), feeSince },
    groups: grade.groups,
    months,
    month,
    students,
    totals,
  };
}

/* ---------------------------------- Seed ---------------------------------- */

function seed(): State {
  const now = currentMonth();
  const m = (offset: number) => addMonths(now, offset);
  const day = (month: IsoMonth, d: number) => `${month}-${String(d).padStart(2, '0')}`;

  const grades: SampleGrade[] = [
    {
      id: 'g3',
      name: 'Grade 3 Secondary',
      // Raised from 300 to 350 two months ago: older months keep 300.
      fees: [
        { from: m(-12), fee: 300 },
        { from: m(-2), fee: 350 },
      ],
      groups: [
        { id: 'g3a', name: 'Group A' },
        { id: 'g3b', name: 'Group B' },
      ],
    },
    {
      id: 'g1',
      name: 'Grade 1 Prep',
      fees: [{ from: m(-12), fee: 300 }],
      groups: [{ id: 'g1a', name: 'Group 1' }],
    },
  ];

  const s = (
    id: string,
    name: string,
    gradeId: string,
    groupId: string,
    joined: number,
    discountPercent = 0,
    discountReason: string | null = null
  ): SampleStudent => ({
    id,
    name,
    code: `26-${id.padStart(4, '0')}`,
    gradeId,
    groupId,
    joinedMonth: m(joined),
    discountPercent,
    discountReason,
  });

  const students = [
    s('1', 'Omar Adel', 'g3', 'g3a', -3),
    s('2', 'Salma Hany', 'g3', 'g3a', -3, 50, 'Twins: sister of Youssef Hany'),
    s('3', 'Youssef Hany', 'g3', 'g3a', -3),
    s('4', 'Hassan Ali', 'g3', 'g3a', -3),
    s('5', 'Karim Omran', 'g3', 'g3b', -3),
    s('6', 'Mariam Fathy', 'g3', 'g3b', -3),
    s('7', 'Laila Ahmed', 'g3', 'g3b', -2),
    s('8', 'Ziad Kamal', 'g3', 'g3a', -3),
    s('9', 'Nour El-Sayed', 'g1', 'g1a', -3),
    s('10', 'Adam Sherif', 'g1', 'g1a', -3),
    s('11', 'Farida Mostafa', 'g1', 'g1a', -3),
    s('12', 'Hamza Tarek', 'g1', 'g1a', -1),
  ];

  let n = 0;
  const pay = (
    studentId: string,
    month: IsoMonth,
    amount: number,
    paidOn: string,
    method: PaymentMethod = 'cash',
    note: string | null = null,
    recordId?: string
  ): SamplePayment => {
    n += 1;
    return {
      id: `p${n}`,
      recordId: recordId ?? `r${n}`,
      studentId,
      month,
      amount,
      paidOn,
      method,
      note,
      voided: null,
    };
  };

  const payments: SamplePayment[] = [];
  // Most students paid the last three months in full.
  for (const student of students) {
    for (const offset of [-3, -2, -1]) {
      const month = m(offset);
      if (month < student.joinedMonth) continue;
      if (student.id === '4' && offset === -1) continue; // Hassan owes last month
      if (student.id === '5' && offset === -2) continue; // Karim's month was skipped
      const grade = grades.find((g) => g.id === student.gradeId)!;
      payments.push(
        pay(
          student.id,
          month,
          applyDiscount(feeFor(grade, month), student.discountPercent),
          day(month, 5)
        )
      );
    }
  }

  // This month so far.
  const today = todayInCairo();
  const thisDay = Number(today.slice(8, 10));
  const d = (k: number) => day(now, Math.max(1, Math.min(thisDay, k)));
  payments.push(
    pay('1', now, 350, d(3)),
    pay('3', now, 350, d(3), 'instapay'),
    pay('5', now, 350, d(4)),
    pay('6', now, 350, d(5), 'instapay', null, 'rMF'),
    pay('6', m(1), 350, d(5), 'instapay', null, 'rMF'), // paid next month ahead
    pay('7', now, 200, d(6), 'cash', 'Rest next week'),
    pay('2', now, 100, d(7), 'cash', 'Rest on Saturday'),
    pay('9', now, 300, d(2), 'vodafone-cash'),
    pay('10', now, 300, d(4)),
    pay('11', now, 150, d(6))
  );

  // A mistake, voided (it stays on record).
  const mistake = pay('2', now, 175, d(2), 'instapay');
  mistake.voided = { on: d(3), reason: 'Was Youssef’s payment, entered on the wrong twin' };
  payments.push(mistake);

  return {
    grades,
    students,
    payments,
    waivers: [{ studentId: '5', month: m(-2), reason: 'Family going through a hard month' }],
    notes: [{ studentId: '2', month: now, text: 'Mother called: will pay the rest on Saturday.' }],
  };
}

/* ---------------------------------- Store --------------------------------- */
// The smallest shared store React supports natively: a value, a list of
// listeners, and useSyncExternalStore to re-render whoever reads it.

let state: State = seed();
const listeners = new Set<() => void>();

const setState = (next: State) => {
  state = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

let nextId = 1000;
const newId = (prefix: string) => `${prefix}${(nextId += 1)}`;

export type RecordPaymentInput = {
  studentId: string;
  months: IsoMonth[];
  amount: number;
  paidOn: string;
  method: PaymentMethod;
  note: string | null;
};

// How an amount spreads over the months picked: each month gets what it
// still needs, oldest first; the last month takes whatever is left (so an
// overpayment shows up instead of disappearing).
export function splitAmount(
  input: Pick<RecordPaymentInput, 'studentId' | 'months' | 'amount'>,
  current: State = state
): { month: IsoMonth; amount: number }[] {
  const student = current.students.find((s) => s.id === input.studentId);
  if (!student) return [];
  const months = [...input.months].sort();
  let remaining = input.amount;

  return months
    .map((month, index) => {
      const isLast = index === months.length - 1;
      const needs = studentMonth(current, student, month);
      const left =
        needs.status === 'not-due' && needs.notDueReason === 'future' ? needs.due : needs.left;
      const amount = isLast ? remaining : Math.min(left, remaining);
      remaining -= amount;
      return { month, amount };
    })
    .filter((part) => part.amount > 0);
}

const actions = {
  recordPayment(input: RecordPaymentInput) {
    const recordId = newId('r');
    const rows = splitAmount(input).map((part): SamplePayment => ({
      id: newId('p'),
      recordId,
      studentId: input.studentId,
      month: part.month,
      amount: part.amount,
      paidOn: input.paidOn,
      method: input.method,
      note: input.note,
      voided: null,
    }));
    setState({ ...state, payments: [...state.payments, ...rows] });
  },

  voidPayment(paymentId: string, reason: string) {
    setState({
      ...state,
      payments: state.payments.map((p) =>
        p.id === paymentId ? { ...p, voided: { on: todayInCairo(), reason } } : p
      ),
    });
  },

  skipMonth(studentId: string, month: IsoMonth, reason: string) {
    setState({ ...state, waivers: [...state.waivers, { studentId, month, reason }] });
  },

  unskipMonth(studentId: string, month: IsoMonth) {
    setState({
      ...state,
      waivers: state.waivers.filter((w) => !(w.studentId === studentId && w.month === month)),
    });
  },

  setNote(studentId: string, month: IsoMonth, text: string) {
    const others = state.notes.filter((n) => !(n.studentId === studentId && n.month === month));
    setState({
      ...state,
      notes: text.trim() ? [...others, { studentId, month, text: text.trim() }] : others,
    });
  },
};

export function usePaymentsSample() {
  const current = useSyncExternalStore(subscribe, () => state);
  return { state: current, ...actions };
}
