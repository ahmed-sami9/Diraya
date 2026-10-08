import type { Request, Response, NextFunction } from 'express';

import { setAuthCookie } from '../auth/auth.cookie';

import { startDemoSession } from './demo.service';

export async function startDemo(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, token, expiresAt } = await startDemoSession();

    // `false`: a session cookie that goes away when the browser closes.
    setAuthCookie(res, token, false, expiresAt);

    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({
      message: 'Demo started',
      user,
    });
  } catch (error) {
    next(error);
  }
}
