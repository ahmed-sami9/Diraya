import type { DemoSeeder } from './demo.seed.types';
import { cairoDaysAgo, pick, seededRandom, weekdayOf } from './demo.seed.helpers';
import { DEMO_GROUPS } from './groups.seed';
import { DEMO_STUDENTS, TERM_START_DAYS_AGO, joinedOn, type Persona } from './students.seed';

// How many classes each persona misses in each third of the term. Exact
// counts, not chances: dice alone sometimes reverse a trend, and the demo's
// story has to hold on every day. Only WHICH days are random.
const ABSENCES_PER_THIRD: Record<Persona, [number, number, number]> = {
  top: [0, 1, 0],
  steady: [1, 1, 1],
  improving: [4, 2, 0],
  declining: [0, 2, 4],
  irregular: [3, 3, 3],
};

// Who picks absence days first: the stories that must show get the days
// when nobody else is missing.
const PRIORITY: readonly Persona[] = ['declining', 'improving', 'irregular', 'steady', 'top'];

const LATE_CHANCE = 0.07;
// Of the classes missed, how many had a reason the teacher accepted.
const EXCUSED_SHARE = 0.3;

const ABSENT_REASONS = ['Sick', 'No transport that day', 'Family occasion', null, null];
const EXCUSED_REASONS = [
  'School exam the same day',
  'Doctor’s appointment',
  'Travelling with family',
];

// Fixed seed: every visitor sees the same attendance.
const RANDOM_SEED = 2026;

type Session = { groupIndex: number; heldOn: string };
type Mark = {
  session: Session;
  studentIndex: number;
  status: 'present' | 'late' | 'absent' | 'excused';
  reason: string | null;
  isMakeUp: boolean;
};

// Every class each group held, from the start of term until yesterday. Today
// is left empty on purpose: the visitor can take today's attendance themselves.
function buildSessions(): Session[] {
  const sessions: Session[] = [];

  for (let daysAgo = TERM_START_DAYS_AGO; daysAgo >= 1; daysAgo--) {
    const heldOn = cairoDaysAgo(daysAgo);
    const weekday = weekdayOf(heldOn);

    DEMO_GROUPS.forEach((group, groupIndex) => {
      if ((group.days as readonly number[]).includes(weekday))
        sessions.push({ groupIndex, heldOn });
    });
  }

  return sessions;
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function buildMarks(sessions: Session[]): Mark[] {
  const random = seededRandom(RANDOM_SEED);
  const joined = DEMO_STUDENTS.map(joinedOn);
  const marks: Mark[] = [];

  DEMO_GROUPS.forEach((group, groupIndex) => {
    const groupSessions = sessions.filter((session) => session.groupIndex === groupIndex);
    const members = DEMO_STUDENTS.map((student, index) => ({ student, index }))
      .filter(({ student }) => student.groupIndex === groupIndex)
      .sort((a, b) => PRIORITY.indexOf(a.student.persona) - PRIORITY.indexOf(b.student.persona));

    const missingOn = new Map<string, number>();
    const absent = new Set<string>();

    for (const { student, index } of members) {
      ABSENCES_PER_THIRD[student.persona].forEach((perThird, third) => {
        const window = groupSessions.slice(
          Math.floor((groupSessions.length * third) / 3),
          Math.floor((groupSessions.length * (third + 1)) / 3)
        );
        const attendable = window.filter((session) => joined[index]! <= session.heldOn);
        // A late joiner misses proportionally fewer: they were there for fewer classes.
        const count = Math.round((perThird * attendable.length) / (window.length || 1));

        // Days nobody else missed come first. "Irregular" students miss the
        // group's first weekday most (Adam's Saturdays).
        const firstDay = group.days[0];
        const order = (sessions: Session[]) =>
          shuffled(sessions, random).sort(
            (a, b) =>
              Number(student.persona === 'irregular' && weekdayOf(b.heldOn) === firstDay) -
              Number(student.persona === 'irregular' && weekdayOf(a.heldOn) === firstDay)
          );
        const free = attendable.filter((session) => !missingOn.get(session.heldOn));
        const taken = attendable.filter((session) => missingOn.get(session.heldOn));

        for (const session of [...order(free), ...order(taken)].slice(0, count)) {
          absent.add(`${index}|${session.heldOn}`);
          missingOn.set(session.heldOn, (missingOn.get(session.heldOn) ?? 0) + 1);
        }
      });
    }

    for (const session of groupSessions) {
      for (const { index } of members) {
        if (joined[index]! > session.heldOn) continue;

        let status: Mark['status'] = 'present';
        let reason: string | null = null;

        if (absent.has(`${index}|${session.heldOn}`)) {
          const excused = random() < EXCUSED_SHARE;
          status = excused ? 'excused' : 'absent';
          reason = pick(excused ? EXCUSED_REASONS : ABSENT_REASONS, Math.floor(random() * 15));
        } else if (random() < LATE_CHANCE) {
          status = 'late';
        }

        marks.push({ session, studentIndex: index, status, reason, isMakeUp: false });
      }
    }
  });

  return marks;
}

// An "irregular" student who missed a class sometimes catches up in the other
// group of the same grade within the next three days: a make-up.
function addMakeUps(sessions: Session[], marks: Mark[]): void {
  const random = seededRandom(RANDOM_SEED + 1);

  for (const mark of [...marks]) {
    const student = DEMO_STUDENTS[mark.studentIndex]!;
    if (mark.status !== 'absent' || student.persona !== 'irregular' || random() > 0.5) continue;

    const deadline = cairoDaysAgo(-3, mark.session.heldOn);
    const makeUp = sessions.find(
      (session) =>
        session.groupIndex !== student.groupIndex &&
        DEMO_GROUPS[session.groupIndex]!.gradeIndex === student.gradeIndex &&
        session.heldOn > mark.session.heldOn &&
        session.heldOn <= deadline
    );

    if (makeUp) {
      marks.push({
        session: makeUp,
        studentIndex: mark.studentIndex,
        status: 'present',
        reason: null,
        isMakeUp: true,
      });
    }
  }
}

export const attendanceSeeder: DemoSeeder = {
  name: 'attendance',

  async run({ client, teacherId, created }) {
    const { grades, groups, students } = created;

    if (!grades || !groups || !students) {
      throw new Error('The attendance seeder needs the grades, groups and students seeders first.');
    }

    const sessions = buildSessions();
    const marks = buildMarks(sessions);
    addMakeUps(sessions, marks);

    // Sessions start at their group's time; the sheet was opened at that time.
    const sessionResult = await client.query<{ id: string; group_id: string; held_on: string }>(
      `
        INSERT INTO class_sessions (teacher_id, grade_id, group_id, held_on, start_time, created_at)
        SELECT $1, s.grade_id, s.group_id, s.held_on, s.start_time,
               (s.held_on + s.start_time) AT TIME ZONE 'Africa/Cairo'
        FROM unnest($2::bigint[], $3::bigint[], $4::date[], $5::time[])
          AS s(grade_id, group_id, held_on, start_time)
        RETURNING id::text, group_id::text, held_on::text
      `,
      [
        teacherId,
        sessions.map((session) => grades[DEMO_GROUPS[session.groupIndex]!.gradeIndex]!),
        sessions.map((session) => groups[session.groupIndex]!),
        sessions.map((session) => session.heldOn),
        sessions.map((session) => DEMO_GROUPS[session.groupIndex]!.startTime),
      ]
    );

    // One session per group per day (a database rule), so group + day identifies it.
    const sessionId = new Map(
      sessionResult.rows.map((row) => [`${row.group_id}|${row.held_on}`, row.id])
    );
    const idOf = (session: Session) =>
      sessionId.get(`${groups[session.groupIndex]}|${session.heldOn}`)!;

    // Marked 15 minutes into the class.
    await client.query(
      `
        INSERT INTO attendance_records (session_id, student_id, grade_id, status, reason, is_make_up, marked_at)
        SELECT r.session_id, r.student_id, cs.grade_id, r.status, r.reason, r.is_make_up,
               (cs.held_on + cs.start_time) AT TIME ZONE 'Africa/Cairo' + INTERVAL '15 minutes'
        FROM unnest($1::bigint[], $2::bigint[], $3::text[], $4::text[], $5::boolean[])
          AS r(session_id, student_id, status, reason, is_make_up)
        JOIN class_sessions cs ON cs.id = r.session_id
      `,
      [
        marks.map((mark) => idOf(mark.session)),
        marks.map((mark) => students[mark.studentIndex]!),
        marks.map((mark) => mark.status),
        marks.map((mark) => mark.reason),
        marks.map((mark) => mark.isMakeUp),
      ]
    );
  },
};
