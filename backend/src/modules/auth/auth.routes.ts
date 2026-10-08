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
} from './auth.validation';

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

router.post('/login', loginLimiter, validateTeacherLogin, login);

// Google sign-in shares the login limiter: both are attempts to get a session.
router.post('/google', loginLimiter, validateGoogleLogin, googleLogin);

router.post('/signup', signupLimiter, validateTeacherSignup, signup);

router.post('/logout', logoutController);

router.get('/me', authenticate, getCurrentUser);

export default router;
