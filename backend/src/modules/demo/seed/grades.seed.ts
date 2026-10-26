import type { DemoSeeder } from './demo.seed.types';
import { daysAgo } from './demo.seed.helpers';

// Exported so later seeders (payments) use the same fees instead of copying them.
export const DEMO_GRADES = [
  { name: 'Grade 1 Secondary', monthlyFee: 350 },
  { name: 'Grade 2 Secondary', monthlyFee: 400 },
  { name: 'Grade 3 Secondary', monthlyFee: 450 },
] as const;

// Created about four months ago, a day apart: the account looks established,
// and the grades list (ordered by created_at) shows them 1, 2, 3.
const FIRST_CREATED_DAYS_AGO = 120;

export const gradesSeeder: DemoSeeder = {
  name: 'grades',

  async run({ client, teacherId, created }) {
    const result = await client.query<{ id: string; name: string }>(
      `
        INSERT INTO grades (teacher_id, name, monthly_fee, created_at)
        SELECT $1, grade.name, grade.fee, grade.created_at
        FROM unnest($2::text[], $3::int[], $4::timestamptz[])
          WITH ORDINALITY AS grade(name, fee, created_at, position)
        ORDER BY grade.position
        RETURNING id::text, name
      `,
      [
        teacherId,
        DEMO_GRADES.map((grade) => grade.name),
        DEMO_GRADES.map((grade) => grade.monthlyFee),
        DEMO_GRADES.map((_, index) => daysAgo(FIRST_CREATED_DAYS_AGO - index)),
      ]
    );

    // Matched by name: RETURNING doesn't promise insertion order. Now
    // created.grades[i] is DEMO_GRADES[i].
    const idByName = new Map(result.rows.map((row) => [row.name, row.id]));
    created.grades = DEMO_GRADES.map((grade) => idByName.get(grade.name)!);
  },
};
