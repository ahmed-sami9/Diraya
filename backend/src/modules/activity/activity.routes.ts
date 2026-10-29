import { Router } from 'express';

import { getActivity } from './activity.controller';
import { validateListActivityQuery } from './activity.validation';

// Recent activity, mounted at /teacher/activity. Read-only on purpose: the
// backend writes activity itself, inside each action (logActivity), so
// there is no POST for a client to fake history with.
//
//   GET /teacher/activity            the latest 10, newest first
//   GET /teacher/activity?limit=6    the Home card

const router = Router();

router.get('/', validateListActivityQuery, getActivity);

export default router;
