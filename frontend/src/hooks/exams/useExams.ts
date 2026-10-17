import { useCallback, useEffect, useState } from 'react';

import { isAbortError } from '../../api/apiClient';
import { createExam, getExams, type ExamInput, type ExamSummary } from '../../api/exams/exams';

type ExamsState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; exams: ExamSummary[] };

// The exams list page's data: every exam with its counted results, and the
// action that adds one.
export function useExams() {
  const [state, setState] = useState<ExamsState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    getExams(controller.signal)
      .then((exams) => setState({ status: 'ready', exams }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;

        console.error(error);
        setState({ status: 'error', error });
      });

    return () => controller.abort();
  }, [reloadKey]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setReloadKey((key) => key + 1);
  }, []);

  // Waits for the server: the list only changes once the exam really exists.
  // Throws on failure, so the dialog can show why.
  const addExam = useCallback(async (input: ExamInput) => {
    const exam = await createExam(input);

    setState((previous) =>
      previous.status === 'ready' ? { status: 'ready', exams: [...previous.exams, exam] } : previous
    );
  }, []);

  return { state, reload, addExam };
}
