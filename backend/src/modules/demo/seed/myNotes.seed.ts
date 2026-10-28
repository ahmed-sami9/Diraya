import type { DemoSeeder } from './demo.seed.types';
import { daysAgo } from './demo.seed.helpers';

// The demo teacher's own notes (My notes): one in each date group, two
// pinned, one edited, so every part of the notes page has something to show.
// Notes about a student are in notes.seed.ts.
const DEMO_MY_NOTES = [
  { daysAgo: 2, pinned: true, text: 'Print the Unit 3 test for Grade 3 before Thursday’s class.' },
  {
    daysAgo: 1,
    pinned: true,
    text: 'The center closes early on 5 Nov: move the Sat & Tue · 6 PM group to 4 PM that week.',
  },
  { daysAgo: 0, pinned: false, text: 'Call Adam’s father about the October fees.' },
  { daysAgo: 4, pinned: false, text: 'Ask the center about fixing the projector in room 2.' },
  {
    daysAgo: 45,
    pinned: false,
    editedDaysAgo: 25,
    text: 'Grade 2 is ahead of schedule. Start revision two weeks early.',
  },
  { daysAgo: 55, pinned: false, text: 'Bring extra past papers for the Grade 1 midterm revision.' },
];

export const myNotesSeeder: DemoSeeder = {
  name: 'my-notes',

  // Needs nothing from the seeders before it: these notes belong to the teacher only.
  async run({ client, teacherId }) {
    await client.query(
      `
        INSERT INTO teacher_notes (teacher_id, text, pinned, created_at, updated_at)
        SELECT $1, n.text, n.pinned, n.created_at, n.updated_at
        FROM unnest($2::text[], $3::boolean[], $4::timestamptz[], $5::timestamptz[])
          AS n(text, pinned, created_at, updated_at)
      `,
      [
        teacherId,
        DEMO_MY_NOTES.map((note) => note.text),
        DEMO_MY_NOTES.map((note) => note.pinned),
        DEMO_MY_NOTES.map((note) => daysAgo(note.daysAgo)),
        DEMO_MY_NOTES.map((note) => daysAgo(note.editedDaysAgo ?? note.daysAgo)),
      ]
    );
  },
};
