import type { Request, Response, NextFunction } from 'express';

import { verifyAccessToken, isInvalidTokenError } from './auth.token';

import { AUTH_COOKIE_NAME } from './auth.cookie';

import { validateAndTouchTeacherSession } from './auth.session.repository';

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (typeof token !== 'string' || !token) {
    res.status(401).json({
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required',
    });
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    const isActive = await validateAndTouchTeacherSession(payload.sid, payload.userId);

    if (!isActive) {
      res.status(401).json({
        code: 'SESSION_EXPIRED',
        message: 'Your session has ended. Please sign in again.',
      });
      return;
    }

    req.user = {
      userId: payload.userId,
      role: payload.role,
    };

    next();
  } catch (error) {
    if (isInvalidTokenError(error)) {
      res.status(401).json({
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired authentication',
      });
      return;
    }

    // Database/configuration failures should remain server errors.
    next(error);
  }
}
