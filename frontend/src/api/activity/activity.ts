import { apiRequest } from '../apiClient';

// Recent activity: what the teacher did, written by the backend inside each
// action (backend/src/modules/activity). Read-only: there's nothing to send.
//
//   GET /teacher/activity?limit=6   -> 200 { activity: ActivityEntry[] }   newest first
//
// The details below mirror backend/src/modules/activity/activity.types.ts
// field for field: facts, not sentences. utils/activity.ts words them.

export type ActivityDetails = {
  'student.added': { studentId: string; studentName: string; gradeName: string; groupName: string };
  'payment.recorded': { studentId: string; studentName: string; amount: number; months: string[] };
  'payment.voided': { studentId: string; studentName: string; amount: number; reason: string };
  'attendance.taken': {
    groupId: string;
    groupName: string;
    gradeName: string;
    day: string;
    present: number;
    total: number;
  };
  'exam.added': { examId: string; title: string; gradeName: string; heldOn: string };
  'marks.entered': { examId: string; title: string; gradeName: string; entered: number; total: number };
};

export type ActivityType = keyof ActivityDetails;

// A union: checking `type` tells TypeScript which details come with it.
export type ActivityEntry = {
  [T in ActivityType]: { id: string; type: T; details: ActivityDetails[T]; createdAt: string };
}[ActivityType];

export async function getActivity(
  { limit, signal }: { limit?: number; signal?: AbortSignal } = {}
): Promise<ActivityEntry[]> {
  const query = limit === undefined ? '' : `?limit=${limit}`;
  const data = await apiRequest<{ activity: ActivityEntry[] }>('GET', `/teacher/activity${query}`, {
    signal,
  });

  return data.activity;
}
