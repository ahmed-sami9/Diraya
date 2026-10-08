import { AppError } from '../../errors/AppError';

// Every error the auth module can throw on purpose, in one place.
// The codes must match the frontend's AuthErrorCode type.
export const AuthErrors = {
  emailTaken: () => new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists.'),

  // Ready for when you tighten up sign-in:
  invalidCredentials: () =>
    new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.'),

  // The password was right, but the teacher has not clicked the link in the
  // confirmation email yet.
  emailNotVerified: () =>
    new AppError(
      403,
      'EMAIL_NOT_VERIFIED',
      'Please confirm your email address before signing in. Check your inbox for the link we sent.'
    ),

  // Email confirmation: the link is wrong, already used, or expired.
  invalidVerificationToken: () =>
    new AppError(
      400,
      'INVALID_VERIFICATION_TOKEN',
      'This confirmation link is invalid or has expired.'
    ),

  // Google sign-in: the token is missing, forged, expired, or was issued for
  // a different app.
  invalidGoogleToken: () =>
    new AppError(
      401,
      'INVALID_GOOGLE_TOKEN',
      'Google sign-in could not be verified. Please try again.'
    ),

  // Google has not confirmed that this person owns the email address, so we
  // must not let it sign in to (or create) an account under that email.
  googleEmailNotVerified: () =>
    new AppError(
      403,
      'GOOGLE_EMAIL_NOT_VERIFIED',
      'Your Google email address is not verified. Verify it with Google and try again.'
    ),

  // Password reset: the link is wrong, already used, or older than its
  // lifetime. One message for all three, so the response gives nothing away.
  invalidResetToken: () =>
    new AppError(
      400,
      'INVALID_RESET_TOKEN',
      'This reset link is invalid or has expired. Please request a new one.'
    ),

  // The email already belongs to a teacher who is linked to a different
  // Google account.
  googleAccountMismatch: () =>
    new AppError(
      409,
      'GOOGLE_ACCOUNT_MISMATCH',
      'This email is already linked to a different Google account.'
    ),
};
