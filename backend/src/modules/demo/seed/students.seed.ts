import type { DemoSeeder } from './demo.seed.types';
import { cairoDaysAgo, pick } from './demo.seed.helpers';
import { DEMO_GROUPS } from './groups.seed';

// How a demo student behaves. Attendance, exams and payments all read it, so
// one student's story agrees on every page (the "declining" student misses
// more classes AND scores lower, and the teacher's note mentions it).
export type Persona = 'top' | 'steady' | 'improving' | 'declining' | 'irregular';

// The first classes were held this many days ago; students registered just before.
export const TERM_START_DAYS_AGO = 105;
const REGISTERED_DAYS_AGO = TERM_START_DAYS_AGO + 3;

// Five students per group, in DEMO_GROUPS order.
const NAMES_BY_GROUP = [
  ['Youssef Ahmed', 'Mariam Khaled', 'Omar Tarek', 'Salma Hassan', 'Adam Mostafa'],
  ['Nour Ibrahim', 'Ali Mahmoud', 'Farida Sherif', 'Karim Adel', 'Habiba Samir'],
  ['Hamza Walid', 'Jana Ashraf', 'Seif Hossam', 'Malak Emad', 'Ziad Reda'],
  ['Lojain Fathy', 'Mohamed Nabil', 'Rawan Gamal', 'Yassin Magdy', 'Hana Ayman'],
  ['Abdelrahman Saeed', 'Menna Hesham', 'Mostafa Kamal', 'Rana Osama', 'Eyad Hany'],
  ['Laila Fouad', 'Ahmed Yasser', 'Tasneem Wael', 'Marwan Amr', 'Dalia Raafat'],
] as const;

// Rotated per group, so every group has one of each.
const PERSONAS: readonly Persona[] = ['top', 'steady', 'improving', 'declining', 'irregular'];

// Joined after the term started: they owe fewer months and have shorter histories.
const LATE_JOINERS: Record<string, number> = {
  'Habiba Samir': 45,
  'Hana Ayman': 38,
  'Dalia Raafat': 12,
};

const DISCOUNTS: Record<string, { percent: number; reason: string }> = {
  'Mariam Khaled': { percent: 25, reason: 'Sibling discount' },
  'Rana Osama': { percent: 50, reason: 'Top of last year’s class' },
};

// The private "notes" field on the student (dated notes are the notes seeder's job).
const STUDENT_NOTES: Record<string, string> = {
  'Abdelrahman Saeed': 'Father prefers WhatsApp messages to calls.',
  'Hana Ayman': 'Joined after the term started. Sent her the first unit’s notes.',
};

export type DemoStudent = {
  name: string;
  groupIndex: number;
  gradeIndex: number;
  persona: Persona;
  // The payments seeder works out each month's due from this.
  discount: { percent: number; reason: string } | null;
  // Kept as "days ago", not a date: turned into a day when the demo is created,
  // so a server that runs for weeks still seeds data relative to today.
  joinedDaysAgo: number;
};

// "YYYY-MM-DD" in Egypt: no attendance, exams or fees before this day.
export const joinedOn = (student: DemoStudent) => cairoDaysAgo(student.joinedDaysAgo);

export const DEMO_STUDENTS: DemoStudent[] = NAMES_BY_GROUP.flatMap((names, groupIndex) =>
  names.map((name, position) => ({
    name,
    groupIndex,
    gradeIndex: DEMO_GROUPS[groupIndex]!.gradeIndex,
    persona: pick(PERSONAS, position + groupIndex),
    discount: DISCOUNTS[name] ?? null,
    joinedDaysAgo: LATE_JOINERS[name] ?? REGISTERED_DAYS_AGO,
  }))
);

// Valid Egyptian mobiles (01 + network digit + 8 digits), different for each
// student and the same on every run.
const mobile = (seed: number) =>
  `01${pick(['0', '1', '2', '5'], seed)}${String(10_000_000 + ((seed * 7_654_321) % 89_999_999))}`;

export const studentsSeeder: DemoSeeder = {
  name: 'students',

  async run({ client, teacherId, created }) {
    const { grades, groups } = created;

    if (!grades || !groups) {
      throw new Error('The students seeder needs the grades and groups seeders to run first.');
    }

    // Codes are numbered in joining order, like the real "Add student" does:
    // "26-0001" for the first one, and so on.
    const byJoining = DEMO_STUDENTS.map((student, index) => ({ student, index })).sort(
      (a, b) => b.student.joinedDaysAgo - a.student.joinedDaysAgo || a.index - b.index
    );
    const codeOf = new Map(
      byJoining.map(({ student, index }, order) => [
        index,
        `${joinedOn(student).slice(2, 4)}-${String(order + 1).padStart(4, '0')}`,
      ])
    );

    const rows = DEMO_STUDENTS.map((student, index) => ({
      gradeId: grades[student.gradeIndex]!,
      groupId: groups[student.groupIndex]!,
      parentPhone: mobile(index + 1),
      // Older students (grades 2 and 3) often have their own phone.
      phone: student.gradeIndex > 0 && index % 2 === 0 ? mobile(index + 101) : null,
      discount: student.discount,
      code: codeOf.get(index)!,
    }));

    // Joined at 10:00 Egypt time on their day, a minute apart so the order is stable.
    const result = await client.query<{ id: string; code: string }>(
      `
        INSERT INTO students (
          teacher_id, grade_id, group_id, full_name, parent_phone, phone, notes,
          discount_percent, discount_reason, code, created_at
        )
        SELECT
          $1, s.grade_id, s.group_id, s.name, s.parent_phone, s.phone, s.notes,
          s.discount_percent, s.discount_reason, s.code,
          (s.joined_on + TIME '10:00' + s.position * INTERVAL '1 minute') AT TIME ZONE 'Africa/Cairo'
        FROM unnest(
          $2::bigint[], $3::bigint[], $4::text[], $5::text[], $6::text[], $7::text[],
          $8::int[], $9::text[], $10::text[], $11::date[]
        ) WITH ORDINALITY AS s(
          grade_id, group_id, name, parent_phone, phone, notes,
          discount_percent, discount_reason, code, joined_on, position
        )
        RETURNING id::text, code
      `,
      [
        teacherId,
        rows.map((row) => row.gradeId),
        rows.map((row) => row.groupId),
        DEMO_STUDENTS.map((student) => student.name),
        rows.map((row) => row.parentPhone),
        rows.map((row) => row.phone),
        DEMO_STUDENTS.map((student) => STUDENT_NOTES[student.name] ?? null),
        rows.map((row) => row.discount?.percent ?? 0),
        rows.map((row) => row.discount?.reason ?? null),
        rows.map((row) => row.code),
        DEMO_STUDENTS.map(joinedOn),
      ]
    );

    // The visitor's first "Add student" must get the next code, not clash with ours.
    await client.query(`UPDATE teachers SET next_student_number = $2 WHERE id = $1`, [
      teacherId,
      DEMO_STUDENTS.length + 1,
    ]);

    // Codes are unique per teacher, so they identify the rows. created.students[i]
    // is DEMO_STUDENTS[i].
    const idByCode = new Map(result.rows.map((row) => [row.code, row.id]));
    created.students = rows.map((row) => idByCode.get(row.code)!);
  },
};
