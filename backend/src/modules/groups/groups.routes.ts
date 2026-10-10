import { Router } from 'express';

import { deleteGroup, patchGroup, postGroup } from './groups.controller';
import {
  validateDeleteGroupQuery,
  validateGroupId,
  validateGroupInput,
} from './groups.validation';

// Groups have two kinds of address, so two routers:
//
//   Inside a grade (creating one needs to know which grade):
//     POST   /teacher/grades/:gradeId/groups      -> gradeGroupsRouter
//
//   On their own (a group id is enough to find it):
//     PATCH  /teacher/groups/:groupId             -> default router
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

router.delete('/:groupId', validateGroupId, validateDeleteGroupQuery, deleteGroup);

export default router;
