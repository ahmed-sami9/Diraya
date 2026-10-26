import type { DemoSeeder } from './demo.seed.types';
import { daysAgo } from './demo.seed.helpers';
import { DEMO_STUDENTS } from './students.seed';

// The teacher's dated notes, matching each student's persona (see students.seed.ts).
const DEMO_NOTES = [
  {
    student: 'Youssef Ahmed',
    daysAgo: 70,
    text: 'Strong in algebra. Give him the challenge problems.',
  },
  {
    student: 'Adam Mostafa',
    daysAgo: 60,
    text: 'Often misses Saturdays (football training). Agreed he comes to the Sun & Wed group instead.',
  },
  {
    student: 'Malak Emad',
    daysAgo: 40,
    text: 'Asked about olympiad preparation. Send her last year’s papers.',
  },
  {
    student: 'Salma Hassan',
    daysAgo: 20,
    text: 'Marks slipping since last month. Called her mother: a lot of school projects right now.',
  },
  {
    student: 'Omar Tarek',
    daysAgo: 15,
    text: 'Much better since the weekly practice sheets. Keep it up.',
  },
  {
    student: 'Jana Ashraf',
    daysAgo: 6,
    text: 'Two low quizzes in a row. Talk to her after Saturday’s class.',
  },
] as const;

export const notesSeeder: DemoSeeder = {
  name: 'notes',

  async run({ client, teacherId, created }) {
    const { students } = created;

    if (!students) throw new Error('The notes seeder needs the students seeder to run first.');

    const studentIds = DEMO_NOTES.map((note) => {
      const index = DEMO_STUDENTS.findIndex((student) => student.name === note.student);
      if (index === -1) throw new Error(`Demo note for unknown student "${note.student}".`);
      return students[index]!;
    });

    await client.query(
      `
        INSERT INTO student_notes (teacher_id, student_id, text, created_at)
        SELECT $1, n.student_id, n.text, n.created_at
        FROM unnest($2::bigint[], $3::text[], $4::timestamptz[]) AS n(student_id, text, created_at)
      `,
      [
        teacherId,
        studentIds,
        DEMO_NOTES.map((note) => note.text),
        DEMO_NOTES.map((note) => daysAgo(note.daysAgo)),
      ]
    );
  },
};
