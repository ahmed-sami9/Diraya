import { Router } from 'express';

import {
  getAttendance,
  getExams,
  getNotes,
  getPayments,
  getProfile,
  postNote,
} from './students.profile.controller';
import { validateNoteInput } from './students.profile.validation';

// One student's profile. Mounted at /teacher/students/:studentId
// (students.routes.ts), which checks the id first, so every route here can
// trust it:
//
//   GET  /                 -> { profile }      header + summary tiles
//   GET  /attendance       -> { attendance }   Attendance tab
//   GET  /exams            -> { exams }        Exams & marks tab
//   GET  /payments         -> { payments }     Payments tab
//   GET  /notes            -> { notes }        Notes tab
//   POST /notes            -> 201 { note }     "Save note"
//
// One resource per address, matching the tabs: each can later be loaded only
// when its tab opens, cached, or paged on its own.

// mergeParams: lets this router read :studentId from where it's mounted.
const router = Router({ mergeParams: true });

router.get('/', getProfile);
router.get('/attendance', getAttendance);
router.get('/exams', getExams);
router.get('/payments', getPayments);
router.get('/notes', getNotes);
router.post('/notes', validateNoteInput, postNote);

export default router;
