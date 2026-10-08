import { pool } from '../../config/db';

export async function findTeacherByEmail(email: string) {
  const result = await pool.query(
    `
      SELECT id, full_name, email, password_hash
      FROM teachers
      WHERE email = $1
    `,
    [email]
  );

  return result.rows[0] ?? null;
}

export async function createTeacher(data: {
  email: string;
  fullName: string;
  passwordHash: string;
}) {
  const result = await pool.query(
    `
      INSERT INTO teachers (full_name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, full_name, email
    `,
    [data.fullName, data.email, data.passwordHash]
  );

  return result.rows[0];
}

export async function findTeacherByGoogleId(googleId: string) {
  const result = await pool.query(
    `
      SELECT id, full_name, email
      FROM teachers
      WHERE google_id = $1
    `,
    [googleId]
  );

  return result.rows[0] ?? null;
}

// First Google sign-in for this Google account. One query covers both cases:
//   - no teacher has this email  -> a new teacher is created (no password)
//   - a teacher has this email   -> Google is linked to that existing teacher
//
// The WHERE clause only allows linking when the teacher has no Google account
// yet. If they are linked to a different one, nothing is returned (null).
export async function createOrLinkGoogleTeacher(data: {
  email: string;
  fullName: string;
  googleId: string;
}) {
  const result = await pool.query(
    `
      INSERT INTO teachers (full_name, email, google_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE
        SET google_id = EXCLUDED.google_id
        WHERE teachers.google_id IS NULL
      RETURNING id, full_name, email
    `,
    [data.fullName, data.email, data.googleId]
  );

  return result.rows[0] ?? null;
}
