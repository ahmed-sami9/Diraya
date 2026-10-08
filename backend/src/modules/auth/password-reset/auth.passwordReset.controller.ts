import type { Request, Response, NextFunction } from 'express';

import { clearAuthCookie } from '../auth.cookie';
import {
  requestPasswordReset,
  isPasswordResetTokenValid,
  resetPassword,
} from './auth.passwordReset.service';

export function forgotPassword(req: Request, res: Response): void {
  const { email } = req.body;

  // Answer first, work afterwards. The response is identical and equally
  // fast whether or not the account exists, so neither the message nor the
  // timing reveals which emails are registered.
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    message: 'If an account exists for this email, a reset link has been sent.',
  });

  requestPasswordReset(email).catch((error) => {
    console.error('Password reset request failed:', error);
  });
}

export async function verifyResetToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const valid = await isPasswordResetTokenValid(req.body.token);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ valid });
  } catch (error) {
    next(error);
  }
}

export async function resetPasswordController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { token, password } = req.body;

    await resetPassword(token, password);

    // Every session was just ended on the server, so drop this browser's
    // cookie too. The teacher signs in again with the new password.
    clearAuthCookie(res);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      message: 'Password updated. Please sign in.',
    });
  } catch (error) {
    next(error);
  }
}
