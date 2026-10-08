// Must match the codes the backend sends (backend auth.errors.ts and the
// rate limiters in auth.routes.ts).
export type AuthErrorCode =
  | 'EMAIL_TAKEN'
  | 'INVALID_CREDENTIALS'
  // Right password, but the email has not been confirmed yet.
  | 'EMAIL_NOT_VERIFIED'
  | 'TOO_MANY_ATTEMPTS'
  // The server rejected the submitted values (too short, too long...).
  | 'INVALID_INPUT'
  | 'SERVER_ERROR';

export class AuthError extends Error {
  code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);

    this.code = code;
  }
}
