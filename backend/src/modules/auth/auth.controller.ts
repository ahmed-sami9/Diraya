import type { Request, Response, NextFunction } from 'express';

import {
  loginTeacher,
  loginTeacherWithGoogle,
  signUpTeacher,
  getTeacherById,
} from './auth.service';

import { AUTH_COOKIE_NAME, setAuthCookie, clearAuthCookie } from './auth.cookie';

import { verifyAccessToken, isInvalidTokenError } from './auth.token';

import { revokeTeacherSession } from './auth.session.repository';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, rememberMe } = req.body;

    const { user, token, expiresAt } = await loginTeacher(email, password, rememberMe);

    setAuthCookie(res, token, rememberMe, expiresAt);

    res.setHeader('Cache-Control', 'no-store');

    res.status(200).json({
      message: 'Login successful',
      user,
    });
  } catch (error) {
    next(error);
  }
}

export async function googleLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { credential, rememberMe } = req.body;

    const { user, token, expiresAt } = await loginTeacherWithGoogle(credential, rememberMe);

    setAuthCookie(res, token, rememberMe, expiresAt);

    res.setHeader('Cache-Control', 'no-store');

    res.status(200).json({
      message: 'Login successful',
      user,
    });
  } catch (error) {
    next(error);
  }
}

export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, token, expiresAt } = await signUpTeacher({
      email: req.body.email,
      password: req.body.password,
      fullName: req.body.fullName,
    });

    setAuthCookie(res, token, false, expiresAt);

    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
}

export async function logoutController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME];

    if (typeof token === 'string' && token) {
      try {
        const payload = verifyAccessToken(token);

        await revokeTeacherSession(payload.sid, payload.userId);
      } catch (error) {
        // Missing/invalid/expired authentication must not prevent
        // clearing the browser cookie.
        if (!isInvalidTokenError(error)) {
          throw error;
        }
      }
    }

    clearAuthCookie(res);

    res.setHeader('Cache-Control', 'no-store');

    res.status(200).json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    // Do not report successful revocation after a database failure.
    next(error);
  }
}

export async function getCurrentUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
      return;
    }

    if (req.user.role !== 'teacher') {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have access to this resource',
      });
      return;
    }

    const user = await getTeacherById(req.user.userId);

    if (!user) {
      res.status(401).json({
        code: 'USER_NOT_FOUND',
        message: 'Authenticated user no longer exists',
      });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}
