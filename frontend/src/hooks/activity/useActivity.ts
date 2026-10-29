import { useCallback, useEffect, useState } from 'react';

import { isAbortError } from '../../api/apiClient';
import { getActivity, type ActivityEntry } from '../../api/activity/activity';

export type ActivityState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; activity: ActivityEntry[] };

type Result = { key: number } & Exclude<ActivityState, { status: 'loading' }>;

// The latest activity (Home: limit 6). Read-only, so no actions: it loads
// again whenever the page that uses it is opened.
export function useActivity({ limit }: { limit?: number } = {}) {
  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getActivity({ limit, signal: controller.signal })
      .then((activity) => setResult({ key: reloadCount, status: 'ready', activity }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        console.error(error);
        setResult({ key: reloadCount, status: 'error', error });
      });

    return () => controller.abort();
  }, [limit, reloadCount]);

  const state: ActivityState =
    result === null || result.key !== reloadCount ? { status: 'loading' } : result;

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  return { state, reload };
}
