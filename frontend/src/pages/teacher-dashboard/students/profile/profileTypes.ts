import type { StudentProfileData } from '../../../../hooks/students/useStudentProfile';

// The data shapes live where the data comes from: the API file (what the
// server sends) and the hook (how the page holds it). They're re-exported
// here so the profile's components import from one nearby place and never
// reach into api/ or hooks/ directly.
export type {
  AttendanceRecord,
  AttendanceStatus,
  ExamResult,
  PaymentMonth,
  StudentProfile,
  StudentSummary,
  TeacherNote,
} from '../../../../api/students/profile';

export type {
  ProfileState,
  StudentProfileData,
} from '../../../../hooks/students/useStudentProfile';

// Everything a teacher can DO on the profile. The components only know these
// names; the layout decides what each one does (a request, a dialog...).
export type ProfileActions = {
  editStudent: () => void;
  shareWithParent: () => void;
  // Builds the 3-month PDF report and saves it.
  downloadReport: () => void;
  moveToGroup: () => void;
  recordPayment: () => void;
  // Resolves when saved; throws (ApiError) when the server refuses.
  addNote: (text: string) => Promise<void>;
  retry: () => void;
};

// What the layout hands to the tab under it (React Router's outlet context).
export type ProfileOutletContext = {
  data: StudentProfileData;
  actions: ProfileActions;
};
