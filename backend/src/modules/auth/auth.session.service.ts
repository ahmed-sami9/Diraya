import { randomUUID } from 'node:crypto';

import { SESSION_POLICY } from './auth.session.config';
import { insertTeacherSession } from './auth.session.repository';
import { generateAccessToken } from './auth.token';

export async function startTeacherSession(teacherId: string, rememberMe: boolean) {
  const sessionId = randomUUID();

  const durationSeconds = rememberMe
    ? SESSION_POLICY.rememberedAbsoluteSeconds
    : SESSION_POLICY.normalAbsoluteSeconds;

  const expiresAtSeconds = Math.floor(Date.now() / 1000) + durationSeconds;

  const expiresAt = new Date(expiresAtSeconds * 1000);

  // Generate first: signing failure should not insert a session.
  const token = generateAccessToken(
    {
      userId: teacherId,
      role: 'teacher',
      sid: sessionId,
    },
    expiresAt
  );

  await insertTeacherSession({
    id: sessionId,
    teacherId,
    rememberMe,
    expiresAt,
  });

  return {
    token,
    expiresAt,
  };
}
