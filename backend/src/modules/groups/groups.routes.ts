import { Router } from 'express';

import { deleteGroup, patchGroup, postGroup, putSchedule } from './groups.controller';
import {
  validateDeleteGroupQuery,
  validateGroupId,
  validateGroupInput,
  validateScheduleInput,
} from './groups.validation';

// Groups have two kinds of address, so two routers:
//
//   Inside a grade (creating one needs to know which grade):
//     POST   /teacher/grades/:gradeId/groups      -> gradeGroupsRouter
//
//   On their own (a group id is enough to find it):
//     PATCH  /teacher/groups/:groupId             -> default router
//     PUT    /teacher/groups/:groupId/schedule    (the whole weekly timetable)
//     DELETE /teacher/groups/:groupId?moveStudentsTo=12
//
// The same split REST APIs often use: create under the parent, change and
// delete by the item's own id.

// mergeParams: lets this router read :gradeId from the path it's mounted
// on (grades.routes.ts), which a router can't see by default.
export const gradeGroupsRouter = Router({ mergeParams: true });

gradeGroupsRouter.post('/', validateGroupInput, postGroup);

const router = Router();

router.patch('/:groupId', validateGroupId, validateGroupInput, patchGroup);

// PUT: it replaces the whole timetable, the same request twice gives the same result.
router.put('/:groupId/schedule', validateGroupId, validateScheduleInput, putSchedule);

router.delete('/:groupId', validateGroupId, validateDeleteGroupQuery, deleteGroup);

export default router;
