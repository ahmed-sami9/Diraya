import { useCallback, useEffect, useState } from 'react';

import { ApiError, isAbortError } from '../../api/apiClient';
import {
  deleteExam,
  getExam,
  saveExamResults,
  updateExam,
  type ExamDetail,
  type ExamResultInput,
  type ExamUpdate,
} from '../../api/exams/exams';

export type ExamState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; detail: ExamDetail };

// What a finished request produced, tagged with the request it answers.
type Result = { key: string } & (
  | { status: 'not-found' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; detail: ExamDetail }
);

// One exam: the exam, the grade's groups, and every student's result.
// Used by both the exam page and the Enter marks page.
//
// "Loading" is DERIVED, not stored: a result that answers an older request
// (another exam, or before "Try again") simply doesn't count. So there is no
// setState inside the effect, and no flash of the previous exam.
export function useExam(examId: string) {
  const [reloadCount, setReloadCount] = useState(0);
  const requestKey = `${examId}:${reloadCount}`;

  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getExam(examId, controller.signal)
      .then((detail) => setResult({ key: requestKey, status: 'ready', detail }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;

        // 404: deleted, someone else's, or a mistyped link. The server says
        // 404 for all three on purpose: it never confirms another teacher's
        // exam exists.
        if (error instanceof ApiError && error.status === 404) {
          setResult({ key: requestKey, status: 'not-found' });
          return;
        }

        console.error(error);
        setResult({ key: requestKey, status: 'error', error });
      });

    return () => controller.abort();
  }, [examId, requestKey]);

  const state: ExamState =
    result === null || result.key !== requestKey ? { status: 'loading' } : result;

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  // Edit. The server answers with the fresh page, which replaces the old one.
  // Throws on failure, so the dialog can show why.
  const update = useCallback(
    async (input: ExamUpdate) => {
      const detail = await updateExam(examId, input);

      setResult({ key: requestKey, status: 'ready', detail });
    },
    [examId, requestKey]
  );

  // Save one group's marks. Like edit, the answer is the fresh page, so the
  // counts and the "saved" values come from the server, not from a guess.
  const saveResults = useCallback(
    async (results: ExamResultInput[]) => {
      const detail = await saveExamResults(examId, results);

      setResult({ key: requestKey, status: 'ready', detail });
    },
    [examId, requestKey]
  );

  // The page leaves after this, so there's nothing to update here.
  const remove = useCallback(() => deleteExam(examId), [examId]);

  return { state, reload, update, remove, saveResults };
}
