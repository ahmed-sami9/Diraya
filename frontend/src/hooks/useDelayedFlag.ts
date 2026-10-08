import { useEffect, useState } from 'react';

/**
 * Returns true only after `active` has stayed true for `delayMs`.
 *
 * Use it to decide when to show a loader: fast responses finish before the
 * delay and never show one, slow responses show one after a short wait.
 */
export function useDelayedFlag(active: boolean, delayMs = 250) {
  const [hasWaited, setHasWaited] = useState(false);

  useEffect(() => {
    if (!active) return;

    const timeoutId = setTimeout(() => setHasWaited(true), delayMs);

    return () => {
      clearTimeout(timeoutId);
      setHasWaited(false);
    };
  }, [active, delayMs]);

  return active && hasWaited;
}
