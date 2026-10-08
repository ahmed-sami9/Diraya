import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().default(false),
});

// `code` is the one-time authorization code from Google's sign-in window.
// Real codes are well under 300 characters, so 2048 is a generous upper limit.
export const googleLoginSchema = z.object({
  code: z.string().min(1).max(2048),
  rememberMe: z.boolean().default(false),
});

export function validateTeacherSignup(req: Request, res: Response, next: NextFunction): void {
  const result = signUpSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      message: 'Invalid signup data',
      errors: result.error.issues,
    });
    return;
  }

  req.body = result.data;
  next();
}

export function validateTeacherLogin(req: Request, res: Response, next: NextFunction): void {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      message: 'Invalid login data',
      errors: result.error.issues,
    });
    return;
  }

  req.body = result.data;
  next();
}

export function validateGoogleLogin(req: Request, res: Response, next: NextFunction): void {
  const result = googleLoginSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      message: 'Invalid Google sign-in data',
      errors: result.error.issues,
    });
    return;
  }

  req.body = result.data;
  next();
}

/* ----------------------------- Password reset ----------------------------- */

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(255),
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
  email: z.string().trim().email().max(255),
});

// Builds a validation middleware from a schema. It does the same job as the
// hand-written validators above, without repeating their body three times.
function validateBody(schema: z.ZodType, message: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        message,
        errors: result.error.issues,
      });
      return;
    }

    req.body = result.data;
    next();
  };
}

export const validateForgotPassword = validateBody(forgotPasswordSchema, 'Invalid email address');

export const validateVerifyResetToken = validateBody(verifyResetTokenSchema, 'Invalid reset link');

export const validateResetPassword = validateBody(resetPasswordSchema, 'Invalid password reset data');

export const validateVerifyEmail = validateBody(verifyEmailSchema, 'Invalid confirmation link');

export const validateResendVerification = validateBody(
  resendVerificationSchema,
  'Invalid email address'
);
