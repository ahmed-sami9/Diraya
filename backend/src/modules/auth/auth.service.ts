import { pool } from '../../config/db';
import {
  createUnverifiedTeacher,
  findTeacherByEmail,
  findTeacherByGoogleId,
  createOrLinkGoogleTeacher,
} from './auth.repository';

import { hashPassword, verifyPassword } from './password';
import { AuthErrors } from './auth.errors';
import { startTeacherSession } from './auth.session.service';
import { getGoogleProfileFromCode } from './auth.google';
import { sendVerificationEmail } from './auth.emailVerification.service';

export async function loginTeacher(email: string, password: string, rememberMe = false) {
  const teacher = await findTeacherByEmail(email);

  if (!teacher || !teacher.password_hash) {
    throw AuthErrors.invalidCredentials();
  }

  const isPasswordValid = await verifyPassword(password, teacher.password_hash);

  if (!isPasswordValid) {
    throw AuthErrors.invalidCredentials();
  }

  // Checked only after the password, so this message is never shown to
  // someone who is just guessing at email addresses.
  if (!teacher.email_verified) {
    throw AuthErrors.emailNotVerified();
  }

  const { token, expiresAt } = await startTeacherSession(String(teacher.id), rememberMe);

  return {
    user: {
      id: String(teacher.id),
      name: teacher.full_name,
      email: teacher.email,
      role: 'teacher' as const,
    },
    token,
    expiresAt,
  };
}

// Password sign-up. It creates the account but does NOT sign the teacher in:
// they first have to click the link we email them, which proves the address
// is theirs. Signing in happens in verifyEmail (auth.emailVerification.service).
export async function signUpTeacher(credentials: {
  email: string;
  password: string;
  fullName: string;
}) {
  const passwordHash = await hashPassword(credentials.password);

  const teacher = await createUnverifiedTeacher({
    email: credentials.email,
    fullName: credentials.fullName,
    passwordHash,
  });

  // null means a verified teacher already owns this email.
  if (!teacher) {
    throw AuthErrors.emailTaken();
  }

  await sendVerificationEmail(teacher);

  return { email: teacher.email as string };
}

// Google sign-in and sign-up in one step: a returning Google user is signed
// in, a new one gets an account created (or linked to their existing email).
export async function loginTeacherWithGoogle(code: string, rememberMe = false) {
  // 1. Exchange the one-time code with Google for a verified profile.
  const profile = await getGoogleProfileFromCode(code);

  // 2. Only trust the email if Google has confirmed the person owns it.
  if (!profile.emailVerified) {
    throw AuthErrors.googleEmailNotVerified();
  }

  // 3. Find the teacher by their permanent Google ID, or create/link one.
  const teacher =
    (await findTeacherByGoogleId(profile.googleId)) ??
    (await createOrLinkGoogleTeacher({
      email: profile.email,
      fullName: profile.fullName,
      googleId: profile.googleId,
    }));

  if (!teacher) {
    throw AuthErrors.googleAccountMismatch();
  }

  // 4. From here on it is identical to a password login.
  const { token, expiresAt } = await startTeacherSession(String(teacher.id), rememberMe);

  return {
    user: {
      id: String(teacher.id),
      name: teacher.full_name,
      email: teacher.email,
      role: 'teacher' as const,
    },
    token,
    expiresAt,
  };
}

export async function getTeacherById(userId: string) {
  const result = await pool.query(
    `
      SELECT id, full_name, email, is_demo
      FROM teachers
      WHERE id = $1
    `,
    [userId]
  );

  const teacher = result.rows[0];

  if (!teacher) {
    return null;
  }

  return {
    id: String(teacher.id),
    name: teacher.full_name,
    email: teacher.email,
    role: 'teacher' as const,
    // Lets the frontend know, after a page refresh too, that this is a
    // temporary demo account.
    isDemo: teacher.is_demo === true,
  };
}
