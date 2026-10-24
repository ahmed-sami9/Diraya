import { pool } from '../../config/db';

import type { ProfileInput } from './account.validation';

// The columns the Settings page needs. The password hash never leaves the
// database through these: only whether one exists.
const ACCOUNT_COLUMNS = `
  full_name,
  email,
  phone,
  password_hash IS NOT NULL AS has_password,
  is_demo
`;

export type AccountRow = {
  full_name: string;
  email: string;
  phone: string | null;
  has_password: boolean;
  is_demo: boolean;
};

export async function findAccount(teacherId: string): Promise<AccountRow | null> {
  const result = await pool.query<AccountRow>(
    `SELECT ${ACCOUNT_COLUMNS} FROM teachers WHERE id = $1`,
    [teacherId]
  );

  return result.rows[0] ?? null;
}

export async function updateProfile(
  teacherId: string,
  input: ProfileInput
): Promise<AccountRow | null> {
  const result = await pool.query<AccountRow>(
    `
      UPDATE teachers
      SET full_name = $2,
          phone = $3
      WHERE id = $1
      RETURNING ${ACCOUNT_COLUMNS}
    `,
    [teacherId, input.fullName, input.phone]
  );

  return result.rows[0] ?? null;
}

// Only for the password check; never sent to the client.
export async function findPasswordDetails(teacherId: string) {
  const result = await pool.query<{
    password_hash: string | null;
    is_demo: boolean;
    full_name: string;
    email: string;
  }>(
    `
      SELECT password_hash, is_demo, full_name, email
      FROM teachers
      WHERE id = $1
    `,
    [teacherId]
  );

  return result.rows[0] ?? null;
}

// Three changes that must succeed or fail together, so one transaction:
//
//   1. save the new password, but only if the old hash is still the one we
//      checked (two changes at the same moment can't both "win")
//   2. sign out every OTHER session (whoever knew the old password is out;
//      the teacher making the change stays signed in)
//   3. cancel unused reset links (an old emailed link can't undo this change)
//
// Returns false when step 1 matched nothing: the password changed meanwhile.
export async function changePassword(input: {
  teacherId: string;
  checkedHash: string;
  newHash: string;
  keepSessionId: string;
}): Promise<boolean> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const updated = await client.query(
      `
        UPDATE teachers
        SET password_hash = $3
        WHERE id = $1
          AND password_hash = $2
      `,
      [input.teacherId, input.checkedHash, input.newHash]
    );

    if (updated.rowCount !== 1) {
      await client.query('ROLLBACK');
      return false;
    }

    await client.query(
      `
        UPDATE teacher_sessions
        SET revoked_at = NOW()
        WHERE teacher_id = $1
          AND id <> $2
          AND revoked_at IS NULL
      `,
      [input.teacherId, input.keepSessionId]
    );

    await client.query(
      `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE teacher_id = $1
          AND used_at IS NULL
      `,
      [input.teacherId]
    );

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
