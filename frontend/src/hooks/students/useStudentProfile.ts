import { useCallback, useEffect, useState } from 'react';

import { ApiError, isAbortError } from '../../api/apiClient';
import {
  createStudentNote,
  getStudentAttendance,
  getStudentExams,
  getStudentNotes,
  getStudentPayments,
  getStudentProfile,
  type AttendanceRecord,
  type ExamResult,
  type PaymentMonth,
  type StudentProfile,
  type TeacherNote,
} from '../../api/students/profile';

// Everything the profile page shows, loaded together.
export type StudentProfileData = {
  profile: StudentProfile;
  attendance: AttendanceRecord[];
  exams: ExamResult[];
  payments: PaymentMonth[];
  notes: TeacherNote[];
};

// The same four states as the grade page. 'not-found' gets its own screen
// ("this student doesn't exist"), not the "try again" error.
export type ProfileState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'not-found' }
  | { status: 'ready'; data: StudentProfileData };

// Loads one student's profile and offers the actions that change it.
//
// Mount it once per student (StudentProfileLayout gives each student its own
// `key`), so opening another student always starts from a clean, loading state.
export function useStudentProfile(studentId: string) {
  const [state, setState] = useState<ProfileState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    // Five requests at the same time, not one after another: the page waits
    // for the slowest, not for all five added up. If any one fails, the
    // whole profile shows the error (one screen, one "Try again").
    Promise.all([
      getStudentProfile(studentId, signal),
      getStudentAttendance(studentId, signal),
      getStudentExams(studentId, signal),
      getStudentPayments(studentId, signal),
      getStudentNotes(studentId, signal),
    ])
      .then(([profile, attendance, exams, payments, notes]) => {
        setState({ status: 'ready', data: { profile, attendance, exams, payments, notes } });
      })
      .catch((error: unknown) => {
        // Left the page, or a newer load replaced this one: not an error.
        if (isAbortError(error)) return;

        if (error instanceof ApiError && error.code === 'STUDENT_NOT_FOUND') {
          setState({ status: 'not-found' });
          return;
        }

        console.error(error);
        setState({ status: 'error', error });
      });

    // Cancels the requests if the page closes (or reloads) before they finish.
    return () => controller.abort();
  }, [studentId, reloadKey]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setReloadKey((key) => key + 1);
  }, []);

  // Waits for the server, then puts the new note at the top. Throws on
  // failure so the note form can show why and keep the text.
  const addNote = useCallback(
    async (text: string) => {
      const note = await createStudentNote(studentId, text);

      setState((previous) =>
        previous.status === 'ready'
          ? { ...previous, data: { ...previous.data, notes: [note, ...previous.data.notes] } }
          : previous
      );
    },
    [studentId]
  );

  return { state, reload, addNote };
}
