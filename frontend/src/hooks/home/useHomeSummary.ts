import { useCallback, useEffect, useState } from 'react';

import { isAbortError } from '../../api/apiClient';
import { getHomeSummary, type HomeSummary } from '../../api/home/home';

export type HomeSummaryState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; summary: HomeSummary };

type Result = { key: number } & (
  { status: 'error'; error: unknown } | { status: 'ready'; summary: HomeSummary }
);

// One request for the whole Home page. Same pattern as useAccount: "loading"
// is derived from whether the answer belongs to the current request.
export function useHomeSummary() {
  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getHomeSummary(controller.signal)
      .then((summary) => setResult({ key: reloadCount, status: 'ready', summary }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        console.error(error);
        setResult({ key: reloadCount, status: 'error', error });
      });

    return () => controller.abort();
  }, [reloadCount]);

  const state: HomeSummaryState =
    result === null || result.key !== reloadCount ? { status: 'loading' } : result;

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  return { state, reload };
}
