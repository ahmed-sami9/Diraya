// Every kind of activity, and the facts each one keeps. This is the contract
// with the frontend: its formats file (one sentence per type) reads exactly
// these shapes. Add a type here and TypeScript makes every logActivity call
// for it pass the right details.
//
// Rules for details:
//   - facts, not sentences (the frontend words them)
//   - names as they were at the time (studentName, groupName...), plus the
//     id so the feed can link to it while it still exists
//   - money in whole pounds, days as "YYYY-MM-DD", months as "YYYY-MM"

export type ActivityDetails = {
  'student.added': {
    studentId: string;
    studentName: string;
    gradeName: string;
    groupName: string;
  };

  'payment.recorded': {
    studentId: string;
    studentName: string;
    amount: number;
    months: string[];
  };

  'payment.voided': {
    studentId: string;
    studentName: string;
    amount: number;
    reason: string;
  };

  'attendance.taken': {
    groupId: string;
    groupName: string;
    gradeName: string;
    day: string;
    present: number;
    total: number;
  };

  'exam.added': {
    examId: string;
    title: string;
    gradeName: string;
    heldOn: string;
  };

  'marks.entered': {
    examId: string;
    title: string;
    gradeName: string;
    entered: number;
    total: number;
  };
};

export type ActivityType = keyof ActivityDetails;

// One entry as the API sends it. A union, so checking `type` tells
// TypeScript (and the frontend) exactly which details come with it.
export type ActivityEntry = {
  [T in ActivityType]: {
    id: string;
    type: T;
    details: ActivityDetails[T];
    createdAt: string;
  };
}[ActivityType];
