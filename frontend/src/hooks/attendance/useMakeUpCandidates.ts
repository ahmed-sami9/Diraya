import { useEffect, useState } from 'react';

import { isAbortError } from '../../api/apiClient';
import { getGradeStudents, type GradeStudent } from '../../api/students/students';

type CandidatesState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; students: GradeStudent[] };

// What came back, and for which grade.
type Result =
  | { gradeId: string; ok: true; students: GradeStudent[] }
  | { gradeId: string; ok: false; error: unknown };

// Students of the same grade who could join this class as a make-up.
// Reuses the grade's student list (GET /teacher/grades/:gradeId/students):
// no new endpoint needed. Loaded only when `enabled` (the picker is open),
// so opening the page costs nothing extra.
//
// "Loading" is not stored: it is simply "no result yet for this grade".
// That avoids setting state at the start of the effect (an extra render).
export function useMakeUpCandidates(gradeId: string | null, enabled: boolean): CandidatesState {
  const [result, setResult] = useState<Result | null>(null);

  const wanted = enabled ? gradeId : null;

  useEffect(() => {
    if (!wanted) return;

    const controller = new AbortController();

    getGradeStudents(wanted, controller.signal)
      .then((students) => setResult({ gradeId: wanted, ok: true, students }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;

        console.error(error);
        setResult({ gradeId: wanted, ok: false, error });
      });

    return () => controller.abort();
  }, [wanted]);

  if (!wanted) return { status: 'idle' };
  if (result?.gradeId !== wanted) return { status: 'loading' };

  return result.ok
    ? { status: 'ready', students: result.students }
    : { status: 'error', error: result.error };
}
