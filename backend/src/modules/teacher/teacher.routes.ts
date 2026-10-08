import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware';
const router = Router();

router.post('/home', authenticate, (req, res) => {
  res.send('teacher');
});

export default router;
