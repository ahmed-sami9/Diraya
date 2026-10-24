import { AppError } from '../../errors/AppError';

// Every error the account module throws on purpose. The codes are the ones
// the frontend reads in api/settings/account.ts.
export const AccountErrors = {
  notFound: () => new AppError(404, 'ACCOUNT_NOT_FOUND', 'This account no longer exists.'),

  // 400, never 401: the frontend reads every 401 as "your session has ended".
  invalidCurrentPassword: () =>
    new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Your current password is incorrect.'),

  // Google-only teachers: there is no password to change.
  noPassword: () =>
    new AppError(409, 'NO_PASSWORD', 'This account signs in with Google and has no password.'),

  demoAccount: () =>
    new AppError(403, 'DEMO_ACCOUNT', 'Demo accounts don’t have a password to change.'),
};
