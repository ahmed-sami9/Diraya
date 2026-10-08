import type { Request, Response, NextFunction } from 'express';
import type { z } from 'zod';

// Validation middleware shared by every module that is not auth.
//
// Each one checks part of the request against a zod schema. If it fails, the
// request stops here with 400 and code INVALID_INPUT, so controllers and
// services only ever see clean, typed data.
//
// The response always has a `code`, which is what the frontend's ApiError
// reads. (auth.validation.ts predates this and sends no code; it can move to
// these helpers later.)

function sendInvalidInput(res: Response, message: string, issues: z.ZodError['issues']): void {
  res.status(400).json({
    code: 'INVALID_INPUT',
    message,
    errors: issues,
  });
}

// For JSON bodies (POST, PATCH). The parsed result replaces req.body, so
// trimmed strings and defaults are what the controller receives.
export function validateBody(schema: z.ZodType, message: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      sendInvalidInput(res, message, result.error.issues);
      return;
    }

    req.body = result.data;
    next();
  };
}

// For the query string (?q=...). In Express 5 req.query is read-only, so the
// parsed result is stored in res.locals.query for the controller instead.
export function validateQuery(schema: z.ZodType, message: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      sendInvalidInput(res, message, result.error.issues);
      return;
    }

    res.locals.query = result.data;
    next();
  };
}
