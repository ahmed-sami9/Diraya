import type { DemoSeeder } from './demo.seed.types';

// Two groups per grade, named the way teachers name them: by when they meet.
// `days` (0 = Sunday ... 6 = Saturday) and `startTime` are exported for the
// attendance seeder, which holds each group's sessions on these days. No two
// groups share a day and time, so the timetable is one a real teacher could keep.
export const DEMO_GROUPS = [
  { gradeIndex: 0, name: 'Sat & Tue · 4 PM', days: [6, 2], startTime: '16:00' },
  { gradeIndex: 0, name: 'Sun & Wed · 6 PM', days: [0, 3], startTime: '18:00' },
  { gradeIndex: 1, name: 'Sat & Tue · 6 PM', days: [6, 2], startTime: '18:00' },
  { gradeIndex: 1, name: 'Mon & Thu · 4 PM', days: [1, 4], startTime: '16:00' },
  { gradeIndex: 2, name: 'Sun & Wed · 4 PM', days: [0, 3], startTime: '16:00' },
  { gradeIndex: 2, name: 'Mon & Thu · 6 PM', days: [1, 4], startTime: '18:00' },
] as const;

export const groupsSeeder: DemoSeeder = {
  name: 'groups',

  async run({ client, teacherId, created }) {
    const gradeIds = created.grades;

    if (!gradeIds) throw new Error('The groups seeder needs the grades seeder to run first.');

    const groupGradeIds = DEMO_GROUPS.map((group) => gradeIds[group.gradeIndex]);

    // Each group is created a few minutes after its grade, so it is never
    // older than the grade it belongs to, and A-before-B order is kept.
    const result = await client.query<{ id: string; grade_id: string; name: string }>(
      `
        INSERT INTO groups (teacher_id, grade_id, name, created_at)
        SELECT $1, g.id, item.name, g.created_at + item.position * INTERVAL '1 minute'
        FROM unnest($2::bigint[], $3::text[]) WITH ORDINALITY AS item(grade_id, name, position)
        JOIN grades g ON g.id = item.grade_id AND g.teacher_id = $1
        ORDER BY item.position
        RETURNING id::text, grade_id::text, name
      `,
      [teacherId, groupGradeIds, DEMO_GROUPS.map((group) => group.name)]
    );

    // A group name is unique only inside its grade, so match on both.
    const idByKey = new Map(result.rows.map((row) => [`${row.grade_id}|${row.name}`, row.id]));
    created.groups = DEMO_GROUPS.map((group, index) =>
      idByKey.get(`${groupGradeIds[index]}|${group.name}`)!
    );
  },
};
