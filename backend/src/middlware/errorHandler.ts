import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

// Express recognizes an error handler by its 4 parameters, so keep all four
// even though `req` and `next` look unused.
export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  // If a response already started streaming, Express's default handler must close it.
  if (res.headersSent) {
    next(err);
    return;
  }

  // Errors we threw on purpose: send their status and code as-is.
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ code: err.code, message: err.message });
    return;
  }

  // Anything else is a bug or an infrastructure failure. Log the details for you,
  // but send the client a generic message so internals (SQL, stack traces) never leak.
  console.error(err);
  res.status(500).json({
    code: 'SERVER_ERROR',
    message: 'Something went wrong on our side.',
  });
}
