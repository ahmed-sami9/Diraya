import { pool } from '../../config/db';
import { SESSION_POLICY } from './auth.session.config';

type CreateSessionInput = {
  id: string;
  teacherId: string;
  rememberMe: boolean;
  expiresAt: Date;
};

export async function insertTeacherSession(input: CreateSessionInput): Promise<void> {
  await pool.query(
    `
      INSERT INTO teacher_sessions (
        id,
        teacher_id,
        remember_me,
        expires_at
      )
      VALUES ($1, $2, $3, $4)
    `,
    [input.id, input.teacherId, input.rememberMe, input.expiresAt]
  );
}

export async function validateAndTouchTeacherSession(
  sessionId: string,
  teacherId: string
): Promise<boolean> {
  const result = await pool.query(
    `
      UPDATE teacher_sessions
      SET last_activity_at = NOW()
      WHERE id = $1
        AND teacher_id = $2
        AND revoked_at IS NULL
        AND expires_at > NOW()
        AND (
          remember_me = TRUE
          OR last_activity_at >
            NOW() - ($3::double precision * INTERVAL '1 second')
        )
      RETURNING id
    `,
    [sessionId, teacherId, SESSION_POLICY.normalIdleSeconds]
  );

  return result.rows.length === 1;
}

export async function revokeTeacherSession(sessionId: string, teacherId: string): Promise<void> {
  await pool.query(
    `
      UPDATE teacher_sessions
      SET revoked_at = NOW()
      WHERE id = $1
        AND teacher_id = $2
        AND revoked_at IS NULL
    `,
    [sessionId, teacherId]
  );
}

export async function revokeAllTeacherSessions(teacherId: string): Promise<void> {
  await pool.query(
    `
      UPDATE teacher_sessions
      SET revoked_at = NOW()
      WHERE teacher_id = $1
        AND revoked_at IS NULL
    `,
    [teacherId]
  );
}
