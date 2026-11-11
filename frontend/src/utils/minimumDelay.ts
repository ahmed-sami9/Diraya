// How long a loading state stays on screen at least. A fast answer would
// otherwise flash the spinner for a split second, which looks like a glitch.
export const MIN_LOADING_MS = 400;

// Resolves once `minimumMs` have passed since `startedAt` (right away if they
// already have). Call it before showing the result, success or error alike.
export function waitForMinimumLoading(
  startedAt: number,
  minimumMs: number = MIN_LOADING_MS
): Promise<void> {
  const remaining = minimumMs - (Date.now() - startedAt);

  return remaining > 0
    ? new Promise((resolve) => setTimeout(resolve, remaining))
    : Promise.resolve();
}
