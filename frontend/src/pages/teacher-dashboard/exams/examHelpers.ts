import type { Exam, ExamKind, ExamResultRow, ExamSummary, IsoDay } from '../../../api/exams/exams';

// What both exam pages share: how dates read, what the colours mean, and how
// a set of results is summarised. Pure functions only, no React.

/* ---------------------------------- Labels -------------------------------- */

export const KIND_LABEL: Record<ExamKind, string> = { exam: 'Exam', quiz: 'Quiz' };

export const examPath = (examId: string) => `/teacher/exams/${examId}`;

/* ---------------------------------- Dates --------------------------------- */

// "2026-10-25" read at noon UTC, so no time zone can shift it to another day.
export const asDate = (day: string) => new Date(`${day}T12:00:00Z`);

const formatter = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' });

export const dayNumber = formatter({ day: 'numeric' });
export const shortMonth = formatter({ month: 'short' });
// "Wed 8 Oct"
export const shortDay = formatter({ weekday: 'short', day: 'numeric', month: 'short' });

// Whole days between two ISO days (both at noon UTC, so always exact).
export const daysBetween = (from: string, to: string) =>
  Math.round((asDate(to).getTime() - asDate(from).getTime()) / 86_400_000);

// "Today", "Tomorrow", "In 5 days": how far away an upcoming exam is.
export function whenLabel(today: IsoDay, heldOn: IsoDay): string {
  const days = daysBetween(today, heldOn);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

/* -------------------------------- Upcoming -------------------------------- */

// Exams from today on, soonest first. An exam held today still counts: the
// teacher may not have held it yet. Shared by the Exams page and Home.
export function upcomingExams(exams: ExamSummary[], today: IsoDay): ExamSummary[] {
  return exams
    .filter((exam) => exam.heldOn >= today)
    .sort((a, b) => a.heldOn.localeCompare(b.heldOn));
}

/* ------------------------------ Missing marks ------------------------------ */

// Past exams that still have students with no result, newest first. "Past"
// means before today in Egypt: an exam held today may not have happened yet.
// Shared by the Exams page banner and the Home tile, so they always agree.
export function examsMissingMarks(exams: ExamSummary[], today: IsoDay): ExamSummary[] {
  return exams
    .filter((exam) => exam.heldOn < today && exam.results.entered < exam.results.total)
    .sort((a, b) => b.heldOn.localeCompare(a.heldOn));
}

// How many students' papers those exams are still waiting for.
export const papersToMark = (exams: ExamSummary[]) =>
  exams.reduce((sum, exam) => sum + exam.results.total - exam.results.entered, 0);

/* ---------------------------------- Tones --------------------------------- */

// Same thresholds as the students table, so a green 85% means the same thing
// on every page.
export type Tone = 'good' | 'watch' | 'low';

export const toneOf = (percent: number): Tone =>
  percent >= 85 ? 'good' : percent >= 65 ? 'watch' : 'low';

export const TONE_TEXT: Record<Tone, string> = {
  good: 'text-success',
  watch: 'text-warning',
  low: 'text-danger',
};

export const TONE_BAR: Record<Tone, string> = {
  good: 'bg-success',
  watch: 'bg-warning',
  low: 'bg-danger',
};

/* ---------------------------------- Marks --------------------------------- */

export const percentOf = (score: number, maxMark: number) => (score / maxMark) * 100;

// 32.4166… -> "32.4", 40 -> "40". Marks are whole or halves; averages get
// one decimal.
export const formatMark = (value: number) => String(Math.round(value * 10) / 10);

export type ResultsSummary = {
  sat: number;
  absent: number;
  notEntered: number;
  // null while nobody has a mark.
  averageScore: number | null;
  averagePercent: number | null;
  highest: number | null;
  lowest: number | null;
  failed: number;
  fullMarks: number;
};

// The exam's numbers, worked out from its rows. The rules, in one place:
//   - average, highest, lowest: only students who SAT it (absent is not 0)
//   - failed:     score below the pass mark
//   - full marks: score equal to "Out of"
// The backend's list summary (averagePercent, failed...) must follow the same
// rules, so the list and this page show the same numbers.
export function summarizeResults(exam: Exam, rows: ExamResultRow[]): ResultsSummary {
  const scores: number[] = [];
  let absent = 0;
  let notEntered = 0;

  for (const row of rows) {
    if (row.status === 'scored' && row.score !== null) scores.push(row.score);
    else if (row.status === 'absent') absent += 1;
    else notEntered += 1;
  }

  if (scores.length === 0) {
    return {
      sat: 0,
      absent,
      notEntered,
      averageScore: null,
      averagePercent: null,
      highest: null,
      lowest: null,
      failed: 0,
      fullMarks: 0,
    };
  }

  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

  return {
    sat: scores.length,
    absent,
    notEntered,
    averageScore,
    averagePercent: Math.round(percentOf(averageScore, exam.maxMark)),
    highest: Math.max(...scores),
    lowest: Math.min(...scores),
    failed: scores.filter((score) => score < exam.passMark).length,
    fullMarks: scores.filter((score) => score === exam.maxMark).length,
  };
}

// The spread chart's bands, by percent. Each band's colour is the tone of
// its lowest percent, so the bars match the colours used everywhere else.
const BANDS = [
  { label: '0–49%', from: 0, to: 50 },
  { label: '50–64%', from: 50, to: 65 },
  { label: '65–84%', from: 65, to: 85 },
  { label: '85–100%', from: 85, to: Infinity },
];

export function spreadOf(exam: Exam, rows: ExamResultRow[]) {
  return BANDS.map((band) => ({
    label: band.label,
    tone: toneOf(band.from),
    count: rows.filter((row) => {
      if (row.status !== 'scored' || row.score === null) return false;
      const percent = percentOf(row.score, exam.maxMark);
      return percent >= band.from && percent < band.to;
    }).length,
  }));
}
