import type { DemoSeeder } from './demo.seed.types';

// The demo's recent activity, built FROM the demo data the seeders before it
// wrote, never invented: the newest student, the latest payments and the
// voided one, the last classes, the newest exams and the latest marks. Each
// entry gets the time its action really happened, so the Home feed matches
// what every other page shows.
//
// The details follow activity.types.ts exactly (the frontend reads them).
// Runs last: it reads what the other seeders created.
export const activitySeeder: DemoSeeder = {
  name: 'activity',

  async run({ client, teacherId }) {
    await client.query(
      `
        INSERT INTO activity (teacher_id, type, details, created_at)

        -- The newest student.
        (SELECT s.teacher_id, 'student.added',
                jsonb_build_object('studentId', s.id::text, 'studentName', s.full_name,
                                   'gradeName', g.name, 'groupName', gr.name),
                s.created_at
         FROM students s
         JOIN grades g ON g.id = s.grade_id
         JOIN groups gr ON gr.id = s.group_id
         WHERE s.teacher_id = $1
         ORDER BY s.created_at DESC
         LIMIT 1)

        UNION ALL

        -- The three latest payments that still stand.
        (SELECT s.teacher_id, 'payment.recorded',
                jsonb_build_object(
                  'studentId', s.id::text, 'studentName', s.full_name, 'amount', p.amount,
                  'months', (SELECT jsonb_agg(to_char(pm.month, 'YYYY-MM') ORDER BY pm.month)
                             FROM payment_months pm WHERE pm.payment_id = p.id)),
                p.created_at
         FROM payments p
         JOIN students s ON s.id = p.student_id
         WHERE s.teacher_id = $1 AND p.voided_at IS NULL
         ORDER BY p.created_at DESC
         LIMIT 3)

        UNION ALL

        -- Every voided payment (the demo has one: recorded twice by mistake).
        (SELECT s.teacher_id, 'payment.voided',
                jsonb_build_object('studentId', s.id::text, 'studentName', s.full_name,
                                   'amount', p.amount, 'reason', p.void_reason),
                p.voided_at
         FROM payments p
         JOIN students s ON s.id = p.student_id
         WHERE s.teacher_id = $1 AND p.voided_at IS NOT NULL)

        UNION ALL

        -- The three latest classes. present = present + late.
        (SELECT cs.teacher_id, 'attendance.taken',
                jsonb_build_object(
                  'groupId', gr.id::text, 'groupName', gr.name, 'gradeName', g.name,
                  'day', to_char(cs.held_on, 'YYYY-MM-DD'),
                  'present', (SELECT COUNT(*) FROM attendance_records r
                              WHERE r.session_id = cs.id AND r.status IN ('present', 'late')),
                  'total', (SELECT COUNT(*) FROM attendance_records r WHERE r.session_id = cs.id)),
                cs.created_at
         FROM class_sessions cs
         JOIN groups gr ON gr.id = cs.group_id
         JOIN grades g ON g.id = cs.grade_id
         WHERE cs.teacher_id = $1
         ORDER BY cs.created_at DESC
         LIMIT 3)

        UNION ALL

        -- The two exams added last (the upcoming ones).
        (SELECT e.teacher_id, 'exam.added',
                jsonb_build_object('examId', e.id::text, 'title', e.title, 'gradeName', g.name,
                                   'heldOn', to_char(e.held_on, 'YYYY-MM-DD')),
                e.created_at
         FROM exams e
         JOIN grades g ON g.id = e.grade_id
         WHERE e.teacher_id = $1
         ORDER BY e.created_at DESC
         LIMIT 2)

        UNION ALL

        -- Marks for the latest exam that has any, counted like the exams list:
        -- the grade's students who had joined by the exam day.
        (SELECT e.teacher_id, 'marks.entered',
                jsonb_build_object(
                  'examId', e.id::text, 'title', e.title, 'gradeName', g.name,
                  'entered', (SELECT COUNT(*) FROM exam_results r WHERE r.exam_id = e.id),
                  'total', (SELECT COUNT(*) FROM students s
                            WHERE s.grade_id = e.grade_id
                              AND (s.created_at AT TIME ZONE 'Africa/Cairo')::date <= e.held_on)),
                (SELECT MAX(r.entered_at) FROM exam_results r WHERE r.exam_id = e.id)
         FROM exams e
         JOIN grades g ON g.id = e.grade_id
         WHERE e.teacher_id = $1
           AND EXISTS (SELECT 1 FROM exam_results r WHERE r.exam_id = e.id)
         ORDER BY e.held_on DESC
         LIMIT 1)
      `,
      [teacherId]
    );
  },
};
