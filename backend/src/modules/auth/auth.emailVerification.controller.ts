import type { Request, Response, NextFunction } from 'express';

import { setAuthCookie } from './auth.cookie';
import { verifyEmail, resendVerificationEmail } from './auth.emailVerification.service';

export async function verifyEmailController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { user, token, expiresAt } = await verifyEmail(req.body.token);

    // Same cookie a normal login sets, with a normal (not "remembered") session.
    setAuthCookie(res, token, false, expiresAt);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      message: 'Email confirmed',
      user,
    });
  } catch (error) {
    next(error);
  }
}

export function resendVerification(req: Request, res: Response): void {
  const { email } = req.body;

  // Answer first, work afterwards. The response is identical and equally
  // fast whether or not the account exists, so neither the message nor the
  // timing reveals which emails are registered.
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    message: 'If this email is waiting to be confirmed, a new link has been sent.',
  });

  resendVerificationEmail(email).catch((error) => {
    console.error('Resending the verification email failed:', error);
  });
}
