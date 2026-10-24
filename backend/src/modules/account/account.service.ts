import { sendEmail } from '../../utils/email';
import { hashPassword, verifyPassword } from '../auth/password';
import { buildPasswordChangedEmail } from '../auth/password-reset/auth.passwordReset.emails';

import { AccountErrors } from './account.errors';
import * as repository from './account.repository';
import type { AccountRow } from './account.repository';
import type { PasswordChangeInput, ProfileInput } from './account.validation';

// The shape the frontend reads (api/settings/account.ts).
const toAccount = (row: AccountRow) => ({
  name: row.full_name,
  email: row.email,
  phone: row.phone,
  hasPassword: row.has_password,
  isDemo: row.is_demo,
});

export async function getAccount(teacherId: string) {
  const row = await repository.findAccount(teacherId);

  if (!row) throw AccountErrors.notFound();

  return toAccount(row);
}

export async function updateProfile(teacherId: string, input: ProfileInput) {
  const row = await repository.updateProfile(teacherId, input);

  if (!row) throw AccountErrors.notFound();

  return toAccount(row);
}

// `sessionId` is the session making the request: it stays signed in.
export async function changePassword(
  teacherId: string,
  sessionId: string,
  input: PasswordChangeInput
): Promise<void> {
  const teacher = await repository.findPasswordDetails(teacherId);

  if (!teacher) throw AccountErrors.notFound();
  if (teacher.is_demo) throw AccountErrors.demoAccount();
  if (!teacher.password_hash) throw AccountErrors.noPassword();

  if (!(await verifyPassword(input.currentPassword, teacher.password_hash))) {
    throw AccountErrors.invalidCurrentPassword();
  }

  const changed = await repository.changePassword({
    teacherId,
    checkedHash: teacher.password_hash,
    newHash: await hashPassword(input.newPassword),
    keepSessionId: sessionId,
  });

  // The password changed between our check and our update: the one typed is
  // no longer current.
  if (!changed) throw AccountErrors.invalidCurrentPassword();

  // Tells the owner, in case it wasn't them. The change already succeeded, so
  // a failed email is logged, not reported.
  try {
    await sendEmail({
      to: teacher.email,
      ...buildPasswordChangedEmail({ fullName: teacher.full_name }),
    });
  } catch (error) {
    console.error('Could not send the password-changed email:', error);
  }
}
