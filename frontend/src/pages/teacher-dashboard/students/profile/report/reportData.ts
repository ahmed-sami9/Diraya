import type {
  AttendanceRecord,
  ExamResult,
  PaymentMonth,
  StudentProfile,
} from '../../../../../api/students/profile';

// What goes in a student's PDF report: the last three months, counted and
// grouped, ready for the PDF to lay out.
//
// The input has no notes field, on purpose: the report can reach a parent,
// and notes are the teacher's alone. Types only at run time, so it's tested
// as a plain function.

export const REPORT_MONTHS = 3;

export type ReportInput = {
  profile: StudentProfile;
  attendance: AttendanceRecord[];
  exams: ExamResult[];
  payments: PaymentMonth[];
};

export type AttendanceMonthRow = {
  month: string;
  label: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  rate: number | null;
  // "Sun 4 Oct", for the absences line.
  absences: string[];
};

export type StudentReport = {
  student: { name: string; code: string; gradeName: string; groupName: string };
  teacherName: string;
  preparedOn: string;
  period: { months: string[]; label: string };
  attendance: { rows: AttendanceMonthRow[]; attended: number; total: number; rate: number | null };
  exams: { rows: (ExamResult & { day: string; percent: number | null })[]; average: number | null };
  fees: { rows: PaymentMonth[]; owed: number };
};

/* --------------------------------- Dates ---------------------------------- */

const cairoMonthOf = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Cairo',
  year: 'numeric',
  month: '2-digit',
});
const cairoDay = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const longDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const monthLabel = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' });
const monthYearLabel = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

// An exact moment -> its month in Egypt: 00:30 on 1 Sep in Cairo is September.
const monthInCairo = (iso: string) => cairoMonthOf.format(new Date(iso)).slice(0, 7);
const dayInCairo = (iso: string) => cairoDay.format(new Date(iso)).replace(',', '');
const asDate = (month: string) => new Date(`${month}-01T00:00:00Z`);

export function addMonths(month: string, count: number): string {
  const date = asDate(month);
  date.setUTCMonth(date.getUTCMonth() + count);
  return date.toISOString().slice(0, 7);
}

// The window ends with this month; oldest first.
export const reportMonths = (currentMonth: string) =>
  Array.from({ length: REPORT_MONTHS }, (_, i) => addMonths(currentMonth, i - REPORT_MONTHS + 1));

function periodLabel(months: string[]): string {
  const first = asDate(months[0]!);
  const last = asDate(months[months.length - 1]!);
  const sameYear = first.getUTCFullYear() === last.getUTCFullYear();

  return `${(sameYear ? monthLabel : monthYearLabel).format(first)} – ${monthYearLabel.format(last)}`;
}

/* ---------------------------------- Rules --------------------------------- */

// The server's rules (attendance.rules.ts): late still came, excused doesn't count.
const toRate = (attended: number, total: number) =>
  total === 0 ? null : Math.round((attended / total) * 100);

const percentOf = (exam: ExamResult) =>
  exam.status === 'scored' && exam.score !== null ? (exam.score / exam.maxScore) * 100 : null;

/* --------------------------------- Report --------------------------------- */

export function buildStudentReport(
  input: ReportInput,
  {
    teacherName,
    currentMonth,
    now = new Date(),
  }: { teacherName: string; currentMonth: string; now?: Date }
): StudentReport {
  const months = reportMonths(currentMonth);
  const inWindow = new Set(months);

  // Attendance: one row per month, oldest first, even an empty month.
  const rows = months.map<AttendanceMonthRow>((month) => {
    const records = input.attendance.filter((record) => monthInCairo(record.heldAt) === month);
    const count = (status: AttendanceRecord['status']) =>
      records.filter((record) => record.status === status).length;
    const present = count('present');
    const late = count('late');
    const absent = count('absent');

    return {
      month,
      label: monthLabel.format(asDate(month)),
      present,
      late,
      absent,
      excused: count('excused'),
      rate: toRate(present + late, present + late + absent),
      absences: records
        .filter((record) => record.status === 'absent')
        .map((record) => dayInCairo(record.heldAt))
        .reverse(),
    };
  });
  const attended = rows.reduce((sum, row) => sum + row.present + row.late, 0);
  const total = rows.reduce((sum, row) => sum + row.present + row.late + row.absent, 0);

  // Exams: newest first, like the profile; only real marks are averaged.
  const examRows = input.exams
    .filter((exam) => inWindow.has(monthInCairo(exam.heldAt)))
    .map((exam) => {
      const percent = percentOf(exam);
      return {
        ...exam,
        day: dayInCairo(exam.heldAt),
        percent: percent === null ? null : Math.round(percent),
      };
    });
  const marks = input.exams
    .filter((exam) => inWindow.has(monthInCairo(exam.heldAt)))
    .map(percentOf)
    .filter((percent) => percent !== null);
  const average =
    marks.length === 0 ? null : Math.round(marks.reduce((sum, p) => sum + p, 0) / marks.length);

  // Fees: the window's months only, so months paid ahead stay out.
  const feeRows = input.payments.filter((payment) => inWindow.has(payment.month));
  const owed = feeRows.reduce(
    (sum, payment) => sum + Math.max(payment.amountDue - payment.amountPaid, 0),
    0
  );

  return {
    student: {
      name: input.profile.name,
      code: input.profile.code,
      gradeName: input.profile.grade.name,
      groupName: input.profile.group.name,
    },
    teacherName,
    preparedOn: longDate.format(now),
    period: { months, label: periodLabel(months) },
    attendance: { rows, attended, total, rate: toRate(attended, total) },
    exams: { rows: examRows, average },
    fees: { rows: feeRows, owed },
  };
}

// "Karim Adel", Aug–Oct 2026 -> "Karim-Adel-report-Aug-Oct-2026.pdf"
export function reportFileName(report: StudentReport): string {
  const short = (month: string) =>
    asDate(month).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  const months = report.period.months;
  const name = report.student.name.trim().replace(/[^\p{L}\p{N}]+/gu, '-');

  return `${name}-report-${short(months[0]!)}-${short(months[months.length - 1]!)}-${months[months.length - 1]!.slice(0, 4)}.pdf`;
}
