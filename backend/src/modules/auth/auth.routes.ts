import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';

import {
  signup,
  login,
  googleLogin,
  logoutController,
  getCurrentUser,
} from './auth.controller';

import {
  validateTeacherSignup,
  validateTeacherLogin,
  validateGoogleLogin,
  validateForgotPassword,
  validateVerifyResetToken,
  validateResetPassword,
  validateVerifyEmail,
  validateResendVerification,
} from './auth.validation';

import {
  forgotPassword,
  verifyResetToken,
  resetPasswordController,
} from './password-reset/auth.passwordReset.controller';

import {
  verifyEmailController,
  resendVerification,
} from './email-verification/auth.emailVerification.controller';

import { startDemo } from '../demo/demo.controller';

import { authenticate } from './auth.middleware';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    code: 'TOO_MANY_ATTEMPTS',
    message: 'Too many login attempts. Please try again later.',
  },
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 'TOO_MANY_ATTEMPTS',
    message: 'Too many signup attempts. Please try again later.',
  },
});

// Asking us to send an email (reset link, or a new confirmation link).
// Kept low: nobody needs many of these.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 'TOO_MANY_ATTEMPTS',
    message: 'Too many email requests. Please try again later.',
  },
});

// Checking and using emailed links (reset and confirmation). Limits
// guessing at tokens.
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 'TOO_MANY_ATTEMPTS',
    message: 'Too many attempts. Please try again later.',
  },
});

// "Try the demo". Every call creates a teacher row, so it is limited to keep
// anyone from filling the database.
const demoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 'TOO_MANY_ATTEMPTS',
    message: 'Too many demo sessions started. Please try again later.',
  },
});

router.post('/login', loginLimiter, validateTeacherLogin, login);

// Google sign-in shares the login limiter: both are attempts to get a session.
router.post('/google', loginLimiter, validateGoogleLogin, googleLogin);

// Lives under /auth because it is one more way of getting a session. Its
// logic is in modules/demo.
router.post('/demo', demoLimiter, startDemo);

router.post('/signup', signupLimiter, validateTeacherSignup, signup);

router.post('/password/forgot', forgotPasswordLimiter, validateForgotPassword, forgotPassword);

router.post(
  '/password/reset/verify',
  resetPasswordLimiter,
  validateVerifyResetToken,
  verifyResetToken
);

router.post('/password/reset', resetPasswordLimiter, validateResetPassword, resetPasswordController);

// Email confirmation after sign-up.
router.post('/email/verify', resetPasswordLimiter, validateVerifyEmail, verifyEmailController);

router.post(
  '/email/verification/resend',
  forgotPasswordLimiter,
  validateResendVerification,
  resendVerification
);

router.post('/logout', logoutController);

router.get('/me', authenticate, getCurrentUser);

export default router;
