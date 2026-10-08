import type { PoolClient } from 'pg';

import type { DemoSeedContext, DemoSeeder } from './seed/demo.seed.types';

// ---------------------------------------------------------------------------
// The demo template
// ---------------------------------------------------------------------------
//
// This is the sample data every new demo teacher starts with. It is empty
// today because the features it will describe (students, courses, quizzes...)
// do not exist yet. Each time you build a feature, add a seeder for it here,
// so the demo grows with the project.
//
// HOW TO ADD A SEEDER
//
// 1. Create a file in ./seed, one per feature, for example
//    ./seed/students.seed.ts:
//
//      import type { DemoSeeder } from './demo.seed.types';
//
//      export const studentsSeeder: DemoSeeder = {
//        name: 'students',
//
//        async run({ client, teacherId, created }) {
//          const result = await client.query(
//            `
//              INSERT INTO students (teacher_id, full_name)
//              VALUES ($1, 'Omar Hassan'), ($1, 'Layla Mahmoud')
//              RETURNING id
//            `,
//            [teacherId]
//          );
//
//          // Write the new IDs down for the seeders that run after this one.
//          created.students = result.rows.map((row) => String(row.id));
//        },
//      };
//
// 2. Import it below and add it to DEMO_SEEDERS.
//
// ORDER MATTERS. Seeders run from top to bottom, so a seeder must come after
// the ones it depends on: students and courses first, then enrolments, then
// quizzes, then quiz results. Charts and statistics need no seeder of their
// own, because they are calculated from that data. Use daysAgo() from
// ./seed/demo.seed.helpers to spread dates over the past weeks, so the charts
// have something to show.
//
// The new table's teacher_id column must have ON DELETE CASCADE, so deleting
// an old demo teacher removes its rows too.
// ---------------------------------------------------------------------------

const DEMO_SEEDERS: DemoSeeder[] = [
  // studentsSeeder,
  // coursesSeeder,
  // enrolmentsSeeder,
  // quizzesSeeder,
  // quizResultsSeeder,
  // paymentsSeeder,
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
