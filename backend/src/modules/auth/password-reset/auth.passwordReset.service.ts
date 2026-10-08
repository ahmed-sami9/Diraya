import { getFrontendOrigin } from '../../../config/frontendOrigin';
import { sendEmail } from '../../../utils/email';

import { AuthErrors } from '../auth.errors';
import { findTeacherByEmail } from '../auth.repository';
import { hashPassword } from '../password';
import { createOneTimeToken, hashOneTimeToken } from '../shared/auth.oneTimeToken';
import { buildPasswordResetEmail, buildPasswordChangedEmail } from './auth.passwordReset.emails';
import {
  hasRecentResetToken,
  replaceResetToken,
  isResetTokenUsable,
  resetPasswordWithToken,
} from './auth.passwordReset.repository';

const RESET_POLICY = {
  // How long a reset link stays valid.
  tokenLifetimeMinutes: 30,
  // At most one reset email per teacher in this window, so the form cannot
  // be used to flood someone's inbox.
  minSecondsBetweenEmails: 60,
} as const;

// The path of the reset page in the frontend router (App.tsx).
const RESET_PAGE_PATH = '/teacher/reset-password';

// Step 1: the teacher asks for a reset link.
//
// It returns nothing and never throws for "no such account": the caller must
// not be able to tell whether the email is registered.
export async function requestPasswordReset(email: string): Promise<void> {
  const teacher = await findTeacherByEmail(email);

  if (!teacher) return;

  const teacherId = String(teacher.id);

  if (await hasRecentResetToken(teacherId, RESET_POLICY.minSecondsBetweenEmails)) return;

  const { token, tokenHash } = createOneTimeToken();

  const expiresAt = new Date(Date.now() + RESET_POLICY.tokenLifetimeMinutes * 60 * 1000);

  // The database gets the hash; only the email gets the real token.
  await replaceResetToken({
    teacherId,
    tokenHash,
    expiresAt,
  });

  const resetLink = `${getFrontendOrigin()}${RESET_PAGE_PATH}?token=${token}`;

  await sendEmail({
    to: teacher.email,
    ...buildPasswordResetEmail({
      fullName: teacher.full_name,
      resetLink,
      expiresInMinutes: RESET_POLICY.tokenLifetimeMinutes,
    }),
  });
}

// Step 2: the reset page asks whether its link still works, so it can show
// "this link has expired" straight away instead of after the form is filled.
export async function isPasswordResetTokenValid(token: string): Promise<boolean> {
  return isResetTokenUsable(hashOneTimeToken(token));
}

// Step 3: the teacher submits a new password.
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashOneTimeToken(token);

  // Cheap check first, so a wrong link does not cost a slow password hash.
  if (!(await isResetTokenUsable(tokenHash))) {
    throw AuthErrors.invalidResetToken();
  }

  const passwordHash = await hashPassword(newPassword);

  // This is the check that counts: it claims the token inside a transaction.
  const teacher = await resetPasswordWithToken(tokenHash, passwordHash);

  if (!teacher) {
    throw AuthErrors.invalidResetToken();
  }

  // Tell the owner. If this email fails, the reset itself still succeeded,
  // so the failure is logged and not reported to the user.
  try {
    await sendEmail({
      to: teacher.email,
      ...buildPasswordChangedEmail({ fullName: teacher.full_name }),
    });
  } catch (error) {
    console.error('Could not send the password-changed email:', error);
  }
}
