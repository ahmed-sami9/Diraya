import { pool } from '../../config/db';
import {
  createTeacher,
  findTeacherByEmail,
  findTeacherByGoogleId,
  createOrLinkGoogleTeacher,
} from './auth.repository';

import { hashPassword, verifyPassword } from './password';
import { AuthErrors } from './auth.errors';
import { startTeacherSession } from './auth.session.service';
import { verifyGoogleCredential } from './auth.google';

export async function loginTeacher(email: string, password: string, rememberMe = false) {
  const teacher = await findTeacherByEmail(email);

  if (!teacher || !teacher.password_hash) {
    throw AuthErrors.invalidCredentials();
  }

  const isPasswordValid = await verifyPassword(password, teacher.password_hash);

  if (!isPasswordValid) {
    throw AuthErrors.invalidCredentials();
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

export async function signUpTeacher(credentials: {
  email: string;
  password: string;
  fullName: string;
}) {
  const existingTeacher = await findTeacherByEmail(credentials.email);

  if (existingTeacher) {
    throw AuthErrors.emailTaken();
  }

  const passwordHash = await hashPassword(credentials.password);

  const teacher = await createTeacher({
    email: credentials.email,
    fullName: credentials.fullName,
    passwordHash,
  });

  // Signup signs in automatically with a normal session.
  const { token, expiresAt } = await startTeacherSession(String(teacher.id), false);

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

// Google sign-in and sign-up in one step: a returning Google user is signed
// in, a new one gets an account created (or linked to their existing email).
export async function loginTeacherWithGoogle(credential: string, rememberMe = false) {
  // 1. Ask Google whether the token is real and meant for this app.
  const profile = await verifyGoogleCredential(credential);

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
      SELECT id, full_name, email
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
  };
}
