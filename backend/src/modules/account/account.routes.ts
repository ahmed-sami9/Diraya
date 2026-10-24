import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';

import { getAccountController, patchProfile, postPassword } from './account.controller';
import { validatePasswordChange, validateProfile } from './account.validation';

// Mounted at /api/v1/teacher/account, behind `authenticate`.
const router = Router();

// Limits guessing the current password from a stolen session. Counted per
// teacher, not per address: it's one account's password being guessed.
export const PASSWORD_ATTEMPTS_LIMIT = 10;

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: PASSWORD_ATTEMPTS_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => req.user!.userId,
  message: {
    code: 'TOO_MANY_ATTEMPTS',
    message: 'Too many attempts. Please try again later.',
  },
});

router.get('/', getAccountController);
router.patch('/profile', validateProfile, patchProfile);
router.post('/password', passwordLimiter, validatePasswordChange, postPassword);

export default router;
