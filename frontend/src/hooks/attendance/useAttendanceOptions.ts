import { useCallback, useEffect, useState } from 'react';

import { isAbortError } from '../../api/apiClient';
import { getAttendanceOptions, type AttendanceGradeOption } from '../../api/attendance/attendance';

type OptionsState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; grades: AttendanceGradeOption[] };

// The teacher's grades and their groups, for the two pickers at the top of
// the Take attendance page. Loaded once per visit.
export function useAttendanceOptions() {
  const [state, setState] = useState<OptionsState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    getAttendanceOptions(controller.signal)
      .then((grades) => setState({ status: 'ready', grades }))
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

  return { state, reload };
}
