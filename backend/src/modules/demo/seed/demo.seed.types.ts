import type { PoolClient } from 'pg';

// What every seeder receives.
export type DemoSeedContext = {
  // The database connection of the transaction that is creating this demo
  // teacher. Always query through this client, never through `pool`:
  // that is what makes the whole demo appear completely or not at all.
  client: PoolClient;

  // The demo teacher who will own every row you insert.
  teacherId: string;

  // A shared notebook between seeders. A seeder writes down the IDs it
  // created so later seeders can link to them. For example the students
  // seeder stores `created.students = [...ids]`, and the quizzes seeder reads
  // them to give each student some results.
  created: Record<string, string[]>;
};

// One seeder fills one feature (students, courses, quizzes...).
export type DemoSeeder = {
  // Shown in the error log if this seeder fails.
  name: string;
  run: (context: DemoSeedContext) => Promise<void>;
};
