import type { Request, Response, NextFunction } from 'express';

import {
  loginTeacher,
  loginTeacherWithGoogle,
  signUpTeacher,
  getTeacherById,
} from './auth.service';

import { AUTH_COOKIE_NAME, setAuthCookie, clearAuthCookie } from './auth.cookie';

import { verifyAccessToken, isInvalidTokenError } from './session/auth.token';

import { revokeTeacherSession } from './session/auth.session.repository';

import { deleteDemoTeacher } from '../demo/demo.repository';

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
    const { code, rememberMe } = req.body;

    const { user, token, expiresAt } = await loginTeacherWithGoogle(code, rememberMe);

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
    const { email } = await signUpTeacher({
      email: req.body.email,
      password: req.body.password,
      fullName: req.body.fullName,
    });

    // No cookie here on purpose. The teacher is signed in only after they
    // confirm their email (see auth.emailVerification.controller.ts).
    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({
      requiresVerification: true,
      email,
      message: 'Account created. Check your inbox to confirm your email address.',
    });
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

        // A demo account has no password, so once its visitor signs out
        // nobody can ever get back into it. Delete it now instead of leaving
        // it for the 24-hour clean-up. Deleting the teacher also deletes its
        // sessions and data (ON DELETE CASCADE), so there is nothing left to
        // revoke. For a real teacher this deletes nothing and returns false.
        const wasDemo = await deleteDemoTeacher(payload.userId);

        if (!wasDemo) {
          await revokeTeacherSession(payload.sid, payload.userId);
        }
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
