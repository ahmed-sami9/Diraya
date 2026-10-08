import { pool } from '../../config/db';

export async function findTeacherByEmail(email: string) {
  const result = await pool.query(
    `
      SELECT id, full_name, email, password_hash, email_verified
      FROM teachers
      WHERE email = $1
    `,
    [email]
  );

  return result.rows[0] ?? null;
}

// Password sign-up. New teachers start unverified (the column's default).
//
// One statement covers three cases, so two sign-ups arriving at the same
// moment cannot trip over each other:
//
//   - email is new                     -> the teacher is created
//   - email exists but is NOT verified -> that row is overwritten. Nobody has
//     proved they own it yet, so an old or mistaken sign-up must not block
//     the real owner (or keep a stranger's password on the account).
//   - email exists and IS verified     -> nothing changes, null is returned
export async function createUnverifiedTeacher(data: {
  email: string;
  fullName: string;
  passwordHash: string;
}) {
  const result = await pool.query(
    `
      INSERT INTO teachers (full_name, email, password_hash)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE
        SET full_name = EXCLUDED.full_name,
            password_hash = EXCLUDED.password_hash
        WHERE teachers.email_verified = FALSE
      RETURNING id, full_name, email
    `,
    [data.fullName, data.email, data.passwordHash]
  );

  return result.rows[0] ?? null;
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
//
// Google has already confirmed the person owns this email, so the teacher
// becomes verified. If the existing account was NOT verified, its password is
// removed: it was typed by someone who never proved they own the address, and
// must not keep working on an account that now belongs to the Google user.
export async function createOrLinkGoogleTeacher(data: {
  email: string;
  fullName: string;
  googleId: string;
}) {
  const result = await pool.query(
    `
      INSERT INTO teachers (full_name, email, google_id, email_verified)
      VALUES ($1, $2, $3, TRUE)
      ON CONFLICT (email) DO UPDATE
        SET google_id = EXCLUDED.google_id,
            email_verified = TRUE,
            password_hash = CASE
              WHEN teachers.email_verified THEN teachers.password_hash
              ELSE NULL
            END
        WHERE teachers.google_id IS NULL
      RETURNING id, full_name, email
    `,
    [data.fullName, data.email, data.googleId]
  );

  return result.rows[0] ?? null;
}
