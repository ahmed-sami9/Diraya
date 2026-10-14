import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, isAbortError } from '../../api/apiClient';
import {
  getAttendanceSheet,
  saveAttendanceSheet,
  type AttendanceSheet,
  type IsoDay,
  type SheetStudent,
} from '../../api/attendance/attendance';
import type { AttendanceStatus } from '../../api/students/profile';

export type SheetState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  // The teacher has no groups at all: nothing to take attendance for.
  | { status: 'no-groups' }
  // The group in the link no longer exists (deleted, or an old bookmark).
  | { status: 'group-not-found' }
  | { status: 'ready'; sheet: AttendanceSheet };

// One student's mark while the teacher is still editing (not saved yet).
export type DraftMark = {
  status: AttendanceStatus;
  reason: string | null;
};

type Marks = Record<string, DraftMark>;

// The starting marks for a sheet: what was saved, or Present for anyone
// without a saved mark. Most students come to class, so the teacher only
// taps the few who didn't.
function initialMarks(students: SheetStudent[]): Marks {
  return Object.fromEntries(
    students.map((student) => [
      student.id,
      { status: student.status ?? 'present', reason: student.reason },
    ])
  );
}

const sameMarks = (a: Marks, b: Marks) =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.entries(a).every(
    ([id, mark]) => b[id]?.status === mark.status && b[id]?.reason === mark.reason
  );

// Which sheet was asked for. reloadKey changes on "Try again".
type SheetRequest = { groupId: string | null; date: IsoDay; reloadKey: number };

type Result =
  | { request: SheetRequest; kind: 'ready'; sheet: AttendanceSheet }
  | { request: SheetRequest; kind: 'no-groups' }
  | { request: SheetRequest; kind: 'group-not-found' }
  | { request: SheetRequest; kind: 'error'; error: unknown };

// Does this result answer the request? Yes if it was for the same day and
// group, or if it was for "the default group" and that default turned out
// to be the group now asked for.
function answers(result: Result, request: SheetRequest): boolean {
  if (result.request.date !== request.date || result.request.reloadKey !== request.reloadKey) {
    return false;
  }

  if (result.request.groupId === request.groupId) return true;

  return (
    result.kind === 'ready' &&
    result.request.groupId === null &&
    result.sheet.group.id === request.groupId
  );
}

// Loads the attendance sheet for one group on one day, and holds the
// teacher's unsaved edits to it.
//
// groupId null: the server picks the default group; the answer's
// sheet.group says which one it picked.
//
// Two copies of the marks live here on purpose:
//   - `saved`: what the server has (from the last load or save)
//   - `marks`: what is on screen now
// "Unsaved changes" is simply "the two differ". Nothing extra to keep in sync.
export function useAttendanceSheet(groupId: string | null, date: IsoDay) {
  const [result, setResult] = useState<Result | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Students added by hand (make-ups) that aren't saved yet.
  const [added, setAdded] = useState<SheetStudent[]>([]);
  const [saved, setSaved] = useState<Marks>({});
  const [marks, setMarks] = useState<Marks>({});

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The latest result, readable inside the effect without making it a
  // dependency (it changes on every load).
  const resultRef = useRef<Result | null>(null);

  const keep = useCallback((next: Result) => {
    resultRef.current = next;
    setResult(next);
  }, []);

  // A sheet arrived (loaded or saved): it becomes both the saved copy and
  // the starting point for editing.
  const showSheet = useCallback(
    (request: SheetRequest, sheet: AttendanceSheet) => {
      const start = initialMarks(sheet.students);

      keep({ request, kind: 'ready', sheet });
      setAdded([]);
      setSaved(start);
      setMarks(start);
      setSaveError(null);
    },
    [keep]
  );

  useEffect(() => {
    const request: SheetRequest = { groupId, date, reloadKey };

    // Already holding the answer? (The page fills the default group into
    // the URL once it's known: that's the same sheet, no second load.)
    if (resultRef.current && answers(resultRef.current, request)) return;

    const controller = new AbortController();

    getAttendanceSheet({ groupId, date }, controller.signal)
      .then((sheet) => showSheet(request, sheet))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;

        if (error instanceof ApiError && error.code === 'NO_GROUPS') {
          keep({ request, kind: 'no-groups' });
          return;
        }

        if (error instanceof ApiError && error.code === 'GROUP_NOT_FOUND') {
          keep({ request, kind: 'group-not-found' });
          return;
        }

        console.error(error);
        keep({ request, kind: 'error', error });
      });

    return () => controller.abort();
  }, [groupId, date, reloadKey, showSheet, keep]);

  // "Loading" is not stored: it is "what we hold doesn't answer what is
  // asked for now". Switching group or day shows loading straight away,
  // with no extra state to forget to reset.
  const state = useMemo<SheetState>(() => {
    if (!result || !answers(result, { groupId, date, reloadKey })) return { status: 'loading' };
    if (result.kind === 'ready') return { status: 'ready', sheet: result.sheet };
    if (result.kind === 'no-groups') return { status: 'no-groups' };
    if (result.kind === 'group-not-found') return { status: 'group-not-found' };
    return { status: 'error', error: result.error };
  }, [result, groupId, date, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const students = useMemo(
    () => (state.status === 'ready' ? [...state.sheet.students, ...added] : []),
    [state, added]
  );

  /* ------------------------------- Editing ------------------------------- */

  const setStatus = useCallback((studentId: string, status: AttendanceStatus) => {
    setMarks((previous) => ({
      ...previous,
      // A reason only makes sense for absent or excused; drop it otherwise.
      [studentId]: {
        status,
        reason:
          status === 'absent' || status === 'excused'
            ? (previous[studentId]?.reason ?? null)
            : null,
      },
    }));
  }, []);

  const setReason = useCallback((studentId: string, reason: string) => {
    setMarks((previous) => {
      const current = previous[studentId];
      if (!current) return previous;

      return { ...previous, [studentId]: { ...current, reason: reason.trim() ? reason : null } };
    });
  }, []);

  // "Mark everyone present" (or absent): the shortcut for a whole class.
  const markAll = useCallback((status: AttendanceStatus) => {
    setMarks((previous) =>
      Object.fromEntries(Object.keys(previous).map((id) => [id, { status, reason: null }]))
    );
  }, []);

  const addMakeUp = useCallback((student: SheetStudent) => {
    setAdded((previous) =>
      previous.some((item) => item.id === student.id) ? previous : [...previous, student]
    );
    setMarks((previous) => ({ ...previous, [student.id]: { status: 'present', reason: null } }));
  }, []);

  // Only make-ups added in this visit can be removed; saved ones stay part
  // of the session's history.
  const removeMakeUp = useCallback((studentId: string) => {
    setAdded((previous) => previous.filter((item) => item.id !== studentId));
    setMarks((previous) => {
      const next = { ...previous };
      delete next[studentId];
      return next;
    });
  }, []);

  const isDirty = !sameMarks(marks, saved);

  // A sheet never saved can be saved as it is ("everyone came"). A saved one
  // only when something changed.
  const canSave =
    state.status === 'ready' && students.length > 0 && (state.sheet.session === null || isDirty);

  /* -------------------------------- Saving ------------------------------- */

  const save = useCallback(async () => {
    if (state.status !== 'ready' || isSaving) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const sheet = await saveAttendanceSheet({
        groupId: state.sheet.group.id,
        date: state.sheet.date,
        records: students.map((student) => ({
          studentId: student.id,
          status: marks[student.id]?.status ?? 'present',
          reason: marks[student.id]?.reason ?? null,
        })),
      });

      // The server's answer becomes the new "saved" copy.
      showSheet({ groupId, date, reloadKey }, sheet);
    } catch (error) {
      console.error(error);
      // The edits stay on screen, so nothing is lost: fix and Save again.
      setSaveError(error instanceof Error ? error.message : 'Couldn’t save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [state, isSaving, students, marks, showSheet, groupId, date, reloadKey]);

  return {
    state,
    reload,
    students,
    marks,
    setStatus,
    setReason,
    markAll,
    addMakeUp,
    removeMakeUp,
    addedIds: added.map((student) => student.id),
    isDirty,
    canSave,
    save,
    isSaving,
    saveError,
  };
}
