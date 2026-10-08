import { useCallback, useEffect, useState } from 'react';

import {
  createGrade,
  deleteGrade,
  getGrades,
  updateGrade,
  type GradeInput,
  type GradeSummary,
} from '../../api/students/grades';
import { isAbortError } from '../../api/apiClient';

type GradesStatus = 'loading' | 'error' | 'ready';

// Everything the Students page needs to know about grades, in one place:
// the list, whether it is still loading, and the actions that change it.
//
// The page never calls the API directly. That keeps the page about layout,
// and keeps "how data is fetched and kept in sync" in this one file.
export function useGrades() {
  const [grades, setGrades] = useState<GradeSummary[]>([]);
  const [status, setStatus] = useState<GradesStatus>('loading');
  // The error itself, not just its text: the error screen reads it to tell
  // "you're offline" apart from "the server isn't answering".
  const [loadError, setLoadError] = useState<unknown>(null);

  // Changing this number runs the loading effect again ("Try again").
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // Cancels the request if the page closes before the answer arrives, so
    // a late answer can't update a page that is gone.
    const controller = new AbortController();

    getGrades(controller.signal)
      .then((list) => {
        setGrades(list);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;

        console.error(error);
        setLoadError(error);
        setStatus('error');
      });

    return () => controller.abort();
  }, [reloadKey]);

  const reload = useCallback(() => {
    setStatus('loading');
    setLoadError(null);
    setReloadKey((key) => key + 1);
  }, []);

  // The three actions below wait for the server before changing the list.
  // The server can refuse (a duplicate name, a grade that still has
  // students), so the list only changes once the server has agreed.
  // Each one throws on failure, so the dialog that called it can show why.

  const addGrade = useCallback(async (input: GradeInput) => {
    const grade = await createGrade(input);

    setGrades((previous) => [...previous, grade]);
  }, []);

  const editGrade = useCallback(async (gradeId: string, input: GradeInput) => {
    const grade = await updateGrade(gradeId, input);

    setGrades((previous) => previous.map((item) => (item.id === gradeId ? grade : item)));
  }, []);

  const removeGrade = useCallback(async (gradeId: string) => {
    await deleteGrade(gradeId);

    setGrades((previous) => previous.filter((item) => item.id !== gradeId));
  }, []);

  return { grades, status, loadError, reload, addGrade, editGrade, removeGrade };
}
