import type { DemoSeeder } from './demo.seed.types';
import { cairoDaysAgo, seededRandom } from './demo.seed.helpers';
import { DEMO_STUDENTS, joinedOn, type Persona } from './students.seed';

// The term's exams, the same for every grade. Negative daysAgo = upcoming.
const TERM_EXAMS = [
  { title: 'Quiz 1', kind: 'quiz', daysAgo: 90, maxMark: 20 },
  { title: 'Unit 1 test', kind: 'exam', daysAgo: 70, maxMark: 50 },
  { title: 'Quiz 2', kind: 'quiz', daysAgo: 49, maxMark: 20 },
  { title: 'Midterm', kind: 'exam', daysAgo: 35, maxMark: 100 },
  { title: 'Quiz 3', kind: 'quiz', daysAgo: 20, maxMark: 20 },
  { title: 'Quiz 4', kind: 'quiz', daysAgo: 9, maxMark: 20 },
] as const;

// Two exams that make the Exams page tell a story:
//   - held two days ago, marks not entered yet -> the "marks missing" banner
//   - next week -> an upcoming card with a countdown
const EXTRA_EXAMS = [
  { gradeIndex: 1, title: 'Unit 2 test', kind: 'exam', daysAgo: 2, maxMark: 50, enterMarks: false },
  {
    gradeIndex: 0,
    title: 'Unit 2 test',
    kind: 'exam',
    daysAgo: -6,
    maxMark: 50,
    enterMarks: false,
  },
  {
    gradeIndex: 2,
    title: 'Unit 3 test',
    kind: 'exam',
    daysAgo: -10,
    maxMark: 50,
    enterMarks: false,
  },
] as const;

// A student's score as a share of "out of", from the first exam of term
// (progress 0) to the last (progress 1). Matches the attendance personas:
// the declining student fails the last two quizzes (Jana's note), the
// improving one climbs past 80%.
const SCORE_SHARE: Record<Persona, (progress: number) => number> = {
  top: () => 0.96,
  steady: () => 0.76,
  improving: (progress) => 0.5 + 0.36 * progress,
  declining: (progress) => 0.88 - 0.5 * progress,
  irregular: () => 0.66,
};
const NOISE = 0.05;

// Fixed seed: every visitor sees the same marks.
const RANDOM_SEED = 7;

type PlannedExam = {
  gradeIndex: number;
  title: string;
  kind: 'exam' | 'quiz';
  heldOn: string;
  maxMark: number;
  enterMarks: boolean;
  progress: number;
};

type PlannedResult = {
  exam: PlannedExam;
  studentIndex: number;
  status: 'scored' | 'absent';
  score: number | null;
};

// Whole or half marks, inside 0..maxMark: the same rule the database checks.
const toMark = (value: number, maxMark: number) =>
  Math.min(maxMark, Math.max(0, Math.round(value * 2) / 2));

function planExams(gradeCount: number): PlannedExam[] {
  const term = Array.from({ length: gradeCount }, (_, gradeIndex) =>
    TERM_EXAMS.map((exam, position) => ({
      ...exam,
      gradeIndex,
      heldOn: cairoDaysAgo(exam.daysAgo),
      enterMarks: true,
      progress: position / (TERM_EXAMS.length - 1),
    }))
  ).flat();

  const extra = EXTRA_EXAMS.map((exam) => ({
    ...exam,
    heldOn: cairoDaysAgo(exam.daysAgo),
    progress: 1,
  }));

  return [...term, ...extra];
}

function planResults(exams: PlannedExam[]): PlannedResult[] {
  const random = seededRandom(RANDOM_SEED);
  const joined = DEMO_STUDENTS.map(joinedOn);
  const results: PlannedResult[] = [];

  for (const exam of exams) {
    if (!exam.enterMarks) continue;

    DEMO_STUDENTS.forEach((student, studentIndex) => {
      // The exam's roster: this grade's students who had joined by that day.
      if (student.gradeIndex !== exam.gradeIndex || joined[studentIndex]! > exam.heldOn) return;

      // The irregular student was absent on the midterm day.
      if (student.persona === 'irregular' && exam.title === 'Midterm') {
        results.push({ exam, studentIndex, status: 'absent', score: null });
        return;
      }

      const share = SCORE_SHARE[student.persona](exam.progress) + (random() * 2 - 1) * NOISE;
      results.push({
        exam,
        studentIndex,
        status: 'scored',
        score: toMark(share * exam.maxMark, exam.maxMark),
      });
    });
  }

  return results;
}

export const examsSeeder: DemoSeeder = {
  name: 'exams',

  async run({ client, teacherId, created }) {
    const { grades, students } = created;

    if (!grades || !students) {
      throw new Error('The exams seeder needs the grades and students seeders to run first.');
    }

    const exams = planExams(grades.length);
    const results = planResults(exams);

    // Pass mark: half of "out of", like the form's default. Created a week
    // before the exam day, as a teacher would schedule it (never in the future).
    const examResult = await client.query<{
      id: string;
      grade_id: string;
      title: string;
      held_on: string;
    }>(
      `
        INSERT INTO exams (teacher_id, grade_id, title, kind, held_on, max_mark, pass_mark, created_at, updated_at)
        SELECT $1, e.grade_id, e.title, e.kind, e.held_on, e.max_mark, e.max_mark / 2.0,
               LEAST(NOW(), (e.held_on - 7 + TIME '20:00') AT TIME ZONE 'Africa/Cairo'),
               LEAST(NOW(), (e.held_on - 7 + TIME '20:00') AT TIME ZONE 'Africa/Cairo')
        FROM unnest($2::bigint[], $3::text[], $4::text[], $5::date[], $6::int[])
          AS e(grade_id, title, kind, held_on, max_mark)
        RETURNING id::text, grade_id::text, title, held_on::text
      `,
      [
        teacherId,
        exams.map((exam) => grades[exam.gradeIndex]!),
        exams.map((exam) => exam.title),
        exams.map((exam) => exam.kind),
        exams.map((exam) => exam.heldOn),
        exams.map((exam) => exam.maxMark),
      ]
    );

    // Grade + title + day identifies each exam in this plan.
    const keyOf = (gradeId: string, title: string, heldOn: string) =>
      `${gradeId}|${title}|${heldOn}`;
    const examId = new Map(
      examResult.rows.map((row) => [keyOf(row.grade_id, row.title, row.held_on), row.id])
    );
    const idOf = (exam: PlannedExam) =>
      examId.get(keyOf(grades[exam.gradeIndex]!, exam.title, exam.heldOn))!;

    // Entered the evening after the exam. max_mark is copied from the exam
    // (the database keeps the two equal).
    await client.query(
      `
        INSERT INTO exam_results (exam_id, student_id, grade_id, max_mark, status, score, entered_at)
        SELECT r.exam_id, r.student_id, e.grade_id, e.max_mark, r.status, r.score,
               (e.held_on + 1 + TIME '20:00') AT TIME ZONE 'Africa/Cairo'
        FROM unnest($1::bigint[], $2::bigint[], $3::text[], $4::numeric[])
          AS r(exam_id, student_id, status, score)
        JOIN exams e ON e.id = r.exam_id
      `,
      [
        results.map((result) => idOf(result.exam)),
        results.map((result) => students[result.studentIndex]!),
        results.map((result) => result.status),
        results.map((result) => result.score),
      ]
    );
  },
};
