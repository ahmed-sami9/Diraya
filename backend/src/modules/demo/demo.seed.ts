import type { PoolClient } from 'pg';

import type { DemoSeedContext, DemoSeeder } from './seed/demo.seed.types';
import { gradesSeeder } from './seed/grades.seed';
import { groupsSeeder } from './seed/groups.seed';
import { studentsSeeder } from './seed/students.seed';
import { attendanceSeeder } from './seed/attendance.seed';
import { examsSeeder } from './seed/exams.seed';
import { paymentsSeeder } from './seed/payments.seed';
import { notesSeeder } from './seed/notes.seed';
import { myNotesSeeder } from './seed/myNotes.seed';
import { activitySeeder } from './seed/activity.seed';

// ---------------------------------------------------------------------------
// The demo template
// ---------------------------------------------------------------------------
//
// This is the sample data every new demo teacher starts with, so "Try the
// demo" opens a dashboard with something on every page. Each time you build
// a feature, add a seeder for it here, so the demo grows with the project.
//
// HOW TO ADD A SEEDER
//
// 1. Create a file in ./seed, one per feature. ./seed/groups.seed.ts is a
//    short example: it reads ids an earlier seeder wrote to `created`,
//    inserts its rows in ONE query through `client`, and writes its own ids
//    to `created` for the seeders after it.
//
// 2. Import it below and add it to DEMO_SEEDERS.
//
// ORDER MATTERS. Seeders run from top to bottom, so a seeder must come after
// the ones it depends on: grades, then groups, then students, then what
// belongs to students (attendance, exams, payments, notes). Charts and
// statistics need no seeder of their own: they are calculated from that data.
// Use the helpers in ./seed/demo.seed.helpers (daysAgo, cairoDaysAgo) so every
// date is relative to today and the demo never looks out of date.
//
// The new table's teacher_id column must have ON DELETE CASCADE, so deleting
// an old demo teacher removes its rows too.
// ---------------------------------------------------------------------------

const DEMO_SEEDERS: DemoSeeder[] = [
  gradesSeeder,
  groupsSeeder,
  studentsSeeder,
  attendanceSeeder,
  examsSeeder,
  paymentsSeeder,
  notesSeeder,
  myNotesSeeder,
  // Last: built from what the seeders above created.
  activitySeeder,
];

// Fills one demo teacher's account with the template data.
//
// It runs inside the transaction that creates the teacher (that is why it
// takes a client). If any seeder fails, the error is thrown, the transaction
// is rolled back, and no half-filled demo account is left behind.
export async function seedDemoData(client: PoolClient, teacherId: string): Promise<void> {
  const context: DemoSeedContext = {
    client,
    teacherId,
    created: {},
  };

  for (const seeder of DEMO_SEEDERS) {
    try {
      await seeder.run(context);
    } catch (error) {
      // Say which seeder broke before the transaction is rolled back.
      console.error(`Demo seeder "${seeder.name}" failed:`, error);

      throw error;
    }
  }
}
