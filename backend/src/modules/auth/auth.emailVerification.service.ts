import { getFrontendOrigin } from '../../config/frontendOrigin';
import { sendEmail } from '../../utils/email';

import { AuthErrors } from './auth.errors';
import { findTeacherByEmail } from './auth.repository';
import { startTeacherSession } from './auth.session.service';
import { createOneTimeToken, hashOneTimeToken } from './auth.oneTimeToken';
import { buildVerificationEmail } from './auth.emailVerification.emails';
import {
  hasRecentVerificationToken,
  replaceVerificationToken,
  verifyTeacherWithToken,
} from './auth.emailVerification.repository';

const VERIFICATION_POLICY = {
  // Longer than a reset link: people often confirm an account hours later.
  tokenLifetimeHours: 24,
  // At most one "resend" per teacher in this window.
  minSecondsBetweenEmails: 60,
} as const;

// The path of the verification page in the frontend router (App.tsx).
const VERIFY_PAGE_PATH = '/teacher/verify-email';

type TeacherForEmail = {
  id: string | number;
  full_name: string;
  email: string;
};

// Creates a fresh link for this teacher and emails it. Any older link stops
// working. Called right after sign-up, and again when the teacher asks for
// the email to be resent.
export async function sendVerificationEmail(teacher: TeacherForEmail): Promise<void> {
  const { token, tokenHash } = createOneTimeToken();

  const expiresAt = new Date(
    Date.now() + VERIFICATION_POLICY.tokenLifetimeHours * 60 * 60 * 1000
  );

  await replaceVerificationToken({
    teacherId: String(teacher.id),
    tokenHash,
    expiresAt,
  });

  const verificationLink = `${getFrontendOrigin()}${VERIFY_PAGE_PATH}?token=${token}`;

  await sendEmail({
    to: teacher.email,
    ...buildVerificationEmail({
      fullName: teacher.full_name,
      verificationLink,
      expiresInHours: VERIFICATION_POLICY.tokenLifetimeHours,
    }),
  });
}

// The teacher did not get (or lost) the first email and asks for another.
//
// Like "forgot password", it returns nothing and never reports whether the
// email belongs to an account.
export async function resendVerificationEmail(email: string): Promise<void> {
  const teacher = await findTeacherByEmail(email);

  // Nothing to do for unknown emails or accounts that are already verified.
  if (!teacher || teacher.email_verified) return;

  const tooSoon = await hasRecentVerificationToken(
    String(teacher.id),
    VERIFICATION_POLICY.minSecondsBetweenEmails
  );

  if (tooSoon) return;

  await sendVerificationEmail(teacher);
}

// The teacher clicked the link in the email.
//
// Clicking it proves they can read that inbox, so the account becomes
// verified and they are signed in straight away with a normal session.
export async function verifyEmail(token: string) {
  const teacher = await verifyTeacherWithToken(hashOneTimeToken(token));

  if (!teacher) {
    throw AuthErrors.invalidVerificationToken();
  }

  const session = await startTeacherSession(String(teacher.id), false);

  return {
    user: {
      id: String(teacher.id),
      name: teacher.full_name,
      email: teacher.email,
      role: 'teacher' as const,
    },
    token: session.token,
    expiresAt: session.expiresAt,
  };
}
