import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

// Requests no route matched: JSON like every other answer, not Express's HTML page.
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ code: 'NOT_FOUND', message: 'This address does not exist.' });
}

// body-parser tags its errors with `type`; only these two are the client's fault.
function readBodyParserError(err: unknown) {
  const type = typeof err === 'object' && err !== null && 'type' in err ? err.type : null;

  if (type === 'entity.parse.failed') {
    return {
      status: 400,
      body: { code: 'INVALID_JSON', message: 'The request body is not valid JSON.' },
    };
  }
  if (type === 'entity.too.large') {
    return {
      status: 413,
      body: { code: 'PAYLOAD_TOO_LARGE', message: 'The request is too large.' },
    };
  }
  return null;
}

// Express recognizes an error handler by its 4 parameters, so keep all four
// even though `req` and `next` look unused.
export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  // If a response already started streaming, Express's default handler must close it.
  if (res.headersSent) {
    next(err);
    return;
  }

  // express.json() refused the body: broken JSON (400) or over the size limit
  // (413). The client sent it wrong, so it is not our crash.
  const bodyError = readBodyParserError(err);
  if (bodyError) {
    res.status(bodyError.status).json(bodyError.body);
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
