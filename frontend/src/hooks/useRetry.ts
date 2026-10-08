import { useState } from 'react';

// State for a "Try again" button.
//
//   isRetrying   true while the attempt runs: show "Trying…" and disable
//                the button, so repeated clicks don't fire more requests
//   stillFailing true when the last attempt failed too, so the screen can
//                say so instead of looking like nothing happened
//
// `attempt` resolves to true when it worked and false when it didn't.
export function useRetry(attempt: () => Promise<boolean>) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [stillFailing, setStillFailing] = useState(false);

  const retry = async () => {
    if (isRetrying) return;

    setIsRetrying(true);
    setStillFailing(false);

    const succeeded = await attempt();

    setIsRetrying(false);
    setStillFailing(!succeeded);
  };

  return { isRetrying, stillFailing, retry };
}
