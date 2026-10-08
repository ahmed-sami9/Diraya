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

// `credential` is the ID token Google's button returns. It is a signed JWT,
// normally 1-2 KB, so 4096 is a generous upper limit.
export const googleLoginSchema = z.object({
  credential: z.string().min(1).max(4096),
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
