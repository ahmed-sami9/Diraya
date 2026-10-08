import type { CookieOptions, Response } from 'express';

export const AUTH_COOKIE_NAME = 'accessToken';

function getBaseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
}

export function setAuthCookie(
  res: Response,
  token: string,
  rememberMe: boolean,
  expiresAt: Date
): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...getBaseCookieOptions(),

    ...(rememberMe
      ? {
          maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
        }
      : {}),
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, getBaseCookieOptions());
}
