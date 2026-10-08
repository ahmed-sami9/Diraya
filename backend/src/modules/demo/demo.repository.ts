import type { PoolClient } from 'pg';

import { pool } from '../../config/db';

type DemoTeacherInput = {
  fullName: string;
  email: string;
};

// Creates one demo teacher and fills it with data, as a single transaction:
// either the teacher exists with all of its sample data, or nothing was
// created at all.
//
// `seed` is passed in (not imported) so this file only knows HOW to create a
// demo teacher safely, and demo.seed.ts only knows WHAT data to put in it.
export async function createDemoTeacher(
  input: DemoTeacherInput,
  seed: (client: PoolClient, teacherId: string) => Promise<void>
) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // No password_hash: nobody can sign in to this account with a password.
    // email_verified is TRUE because there is no inbox to confirm.
    const result = await client.query(
      `
        INSERT INTO teachers (full_name, email, is_demo, email_verified)
        VALUES ($1, $2, TRUE, TRUE)
        RETURNING id, full_name, email
      `,
      [input.fullName, input.email]
    );

    const teacher = result.rows[0];

    await seed(client, String(teacher.id));

    await client.query('COMMIT');

    return teacher;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Deletes demo teachers older than `maxAgeHours`. Their sessions, and every
// other table whose teacher_id has ON DELETE CASCADE, go with them.
//
// Returns how many were removed.
export async function deleteOldDemoTeachers(maxAgeHours: number): Promise<number> {
  const result = await pool.query(
    `
      DELETE FROM teachers
      WHERE is_demo = TRUE
        AND created_at < NOW() - ($1::double precision * INTERVAL '1 hour')
    `,
    [maxAgeHours]
  );

  return result.rowCount ?? 0;
}

// Deletes one teacher, but only if it is a demo teacher. Used when a demo
// visitor signs out.
//
// The `is_demo = TRUE` condition is the safety catch: called with a real
// teacher's ID, it matches no row and deletes nothing.
//
// Returns true when a demo teacher was deleted.
export async function deleteDemoTeacher(teacherId: string): Promise<boolean> {
  const result = await pool.query(
    `
      DELETE FROM teachers
      WHERE id = $1
        AND is_demo = TRUE
    `,
    [teacherId]
  );

  return (result.rowCount ?? 0) > 0;
}
