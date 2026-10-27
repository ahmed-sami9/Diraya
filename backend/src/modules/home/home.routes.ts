import { Router } from 'express';

import { getHome } from './home.controller';

// Mounted at /api/v1/teacher/home, behind `authenticate`.
const router = Router();

router.get('/', getHome);

export default router;
