import { pool } from '../../../config/db';

// Used for the "one email per minute" rule.
export async function hasRecentVerificationToken(
  teacherId: string,
  withinSeconds: number
): Promise<boolean> {
  const result = await pool.query(
    `
      SELECT 1
      FROM email_verification_tokens
      WHERE teacher_id = $1
        AND created_at > NOW() - ($2::double precision * INTERVAL '1 second')
      LIMIT 1
    `,
    [teacherId, withinSeconds]
  );

  return result.rows.length > 0;
}

// Saves a new token and removes every older one for the same teacher in one
// statement, so only the newest link ever works.
export async function replaceVerificationToken(input: {
  teacherId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<void> {
  await pool.query(
    `
      WITH removed AS (
        DELETE FROM email_verification_tokens
        WHERE teacher_id = $1
      )
      INSERT INTO email_verification_tokens (teacher_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `,
    [input.teacherId, input.tokenHash, input.expiresAt]
  );
}

// Uses the link: marks the token as used and the teacher as verified.
// Both changes happen in one transaction, so a token can never end up "used"
// while the teacher is still unverified.
//
// Returns the teacher, or null when the token is missing, used or expired.
export async function verifyTeacherWithToken(tokenHash: string) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // This UPDATE is also the check. It only matches an unused, unexpired
    // token, so two requests with the same link cannot both succeed.
    const claimed = await client.query(
      `
        UPDATE email_verification_tokens
        SET used_at = NOW()
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > NOW()
        RETURNING teacher_id
      `,
      [tokenHash]
    );

    const teacherId = claimed.rows[0]?.teacher_id;

    if (!teacherId) {
      await client.query('ROLLBACK');
      return null;
    }

    const updated = await client.query(
      `
        UPDATE teachers
        SET email_verified = TRUE
        WHERE id = $1
        RETURNING id, full_name, email
      `,
      [teacherId]
    );

    await client.query('COMMIT');

    return updated.rows[0] ?? null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
