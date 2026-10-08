import { pool } from '../../../config/db';

// Used for the "one email per minute" rule.
export async function hasRecentResetToken(
  teacherId: string,
  withinSeconds: number
): Promise<boolean> {
  const result = await pool.query(
    `
      SELECT 1
      FROM password_reset_tokens
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
export async function replaceResetToken(input: {
  teacherId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<void> {
  await pool.query(
    `
      WITH removed AS (
        DELETE FROM password_reset_tokens
        WHERE teacher_id = $1
      )
      INSERT INTO password_reset_tokens (teacher_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `,
    [input.teacherId, input.tokenHash, input.expiresAt]
  );
}

export async function isResetTokenUsable(tokenHash: string): Promise<boolean> {
  const result = await pool.query(
    `
      SELECT 1
      FROM password_reset_tokens
      WHERE token_hash = $1
        AND used_at IS NULL
        AND expires_at > NOW()
    `,
    [tokenHash]
  );

  return result.rows.length === 1;
}

// The actual reset. Three changes that must succeed or fail together, so they
// run in one transaction:
//
//   1. mark the token as used   (the link can never work again)
//   2. save the new password    (and mark the email as verified: using the
//                                link proves they can read that inbox)
//   3. end every session        (anyone signed in with the old password is out)
//
// Returns the teacher, or null when the token is missing, used or expired.
export async function resetPasswordWithToken(tokenHash: string, passwordHash: string) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Step 1 is also the check. Because the UPDATE only matches an unused,
    // unexpired token, two requests with the same link cannot both succeed.
    const claimed = await client.query(
      `
        UPDATE password_reset_tokens
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
        SET password_hash = $2,
            email_verified = TRUE
        WHERE id = $1
        RETURNING id, full_name, email
      `,
      [teacherId, passwordHash]
    );

    await client.query(
      `
        UPDATE teacher_sessions
        SET revoked_at = NOW()
        WHERE teacher_id = $1
          AND revoked_at IS NULL
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
