import { Router } from 'express';

import { getOptions, getSheet, putSheet } from './attendance.controller';
import { validateSaveSheet, validateSheetQuery } from './attendance.validation';

// Mounted at /api/v1/teacher/attendance, behind `authenticate`
// (teacher.routes.ts).
//
//   GET /options   -> { grades }   the grade and group pickers
//   GET /sheet     -> { sheet }    one group on one day. Read only.
//   PUT /sheet     -> { sheet }    save the whole sheet (find or create the
//                                  session, then every mark), idempotent
//
// The sheet is addressed by (groupId, date), not by a session id: the
// teacher thinks "Group A today", and that pair names exactly one session
// (UNIQUE (group_id, held_on)), whether it exists yet or not.
const router = Router();

router.get('/options', getOptions);

router.get('/sheet', validateSheetQuery, getSheet);

router.put('/sheet', validateSaveSheet, putSheet);

export default router;
