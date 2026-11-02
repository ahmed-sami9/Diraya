import { z } from 'zod';

import { validateBody } from '../../middlware/validate';

// Emails are stored and compared in lower case, so "Ahmed@x.com" and
// "ahmed@x.com" are one account. Every schema that takes an email uses this.
const emailSchema = z.string().trim().toLowerCase().email().max(255);

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().default(false),
});

// `code` is the one-time authorization code from Google's sign-in window.
// Real codes are well under 300 characters, so 2048 is a generous upper limit.
export const googleLoginSchema = z.object({
  code: z.string().min(1).max(2048),
  rememberMe: z.boolean().default(false),
});

/* ----------------------------- Password reset ----------------------------- */

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

// One-time tokens (password reset and email verification links) are 43
// characters: 32 random bytes in base64url.
const resetTokenSchema = z.string().min(20).max(200);

export const verifyResetTokenSchema = z.object({
  token: resetTokenSchema,
});

// The new password follows the same rules as sign-up.
export const resetPasswordSchema = z.object({
  token: resetTokenSchema,
  password: z.string().min(8).max(128),
});

/* --------------------------- Email verification --------------------------- */

export const verifyEmailSchema = z.object({
  token: resetTokenSchema,
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

// The shared validator (middlware/validate.ts): a 400 with code INVALID_INPUT,
// like every other module.
export const validateTeacherSignup = validateBody(signUpSchema, 'Invalid signup data');

export const validateTeacherLogin = validateBody(loginSchema, 'Invalid login data');

export const validateGoogleLogin = validateBody(googleLoginSchema, 'Invalid Google sign-in data');

export const validateForgotPassword = validateBody(forgotPasswordSchema, 'Invalid email address');

export const validateVerifyResetToken = validateBody(verifyResetTokenSchema, 'Invalid reset link');

export const validateResetPassword = validateBody(
  resetPasswordSchema,
  'Invalid password reset data'
);

export const validateVerifyEmail = validateBody(verifyEmailSchema, 'Invalid confirmation link');

export const validateResendVerification = validateBody(
  resendVerificationSchema,
  'Invalid email address'
);
