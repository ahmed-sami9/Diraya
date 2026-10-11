import type { ProfileActions, ProfileState } from './profileTypes';

// TEMPORARY. Stands in for the hook and API that don't exist yet, so the
// page can be built and looked at first. Delete this file once
// useStudentProfile(studentId) returns the real ProfileState.
//
// The student's basics already exist in the database; the [brackets] mark
// where they will appear. Every list is empty, so you see each section's
// "nothing yet" state: exactly what a brand-new student looks like.

export function getPlaceholderProfileState(studentId: string): ProfileState {
  return {
    status: 'ready',
    data: {
      profile: {
        id: studentId,
        code: '[code]',
        name: '[Student name]',
        grade: { id: '', name: '[Grade]' },
        group: { id: '', name: '[Group]', sessions: [] },
        parentPhone: '',
        phone: null,
        joinedAt: '',
        monthlyFee: null,
        summary: {
          attendance: { rate: null, attended: 0, total: 0 },
          marks: { average: null, examCount: 0, changeSinceLastMonth: null },
          currentFee: null,
          lastSession: null,
        },
      },
      attendance: [],
      exams: [],
      payments: [],
      notes: [],
    },
  };
}

// Each one becomes a dialog or an API call. For now they only say so in the
// console, so clicking a button shows it is wired to the right action.
export const placeholderActions: ProfileActions = {
  editStudent: () => console.info('TODO: open the Edit student dialog'),
  shareWithParent: () => console.info('TODO: create the parent link (API)'),
  moveToGroup: () => console.info('TODO: open the Move to group dialog'),
  recordPayment: () => console.info('TODO: open the Record payment dialog'),
  addNote: async (text) => console.info('TODO: POST the note (API)', text),
  retry: () => console.info('TODO: load the profile again (hook)'),
};
