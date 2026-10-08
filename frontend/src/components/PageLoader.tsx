import { useDelayedFlag } from '../hooks/useDelayedFlag';

/**
 * Placeholder shown while a dashboard page is loading.
 *
 * It renders nothing for the first 250ms, so a page that loads quickly
 * appears with no flash of a loader.
 */
function PageLoader() {
  const isVisible = useDelayedFlag(true);

  if (!isVisible) return null;

  return (
    <div
      role="status"
      className="flex animate-pulse flex-col gap-6"
    >
      <span className="sr-only">Loading page</span>

      <div className="h-24 rounded-2xl bg-primary-tint" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="h-28 rounded-[14px] bg-border" />
        <div className="h-28 rounded-[14px] bg-border" />
        <div className="h-28 rounded-[14px] bg-border" />
        <div className="h-28 rounded-[14px] bg-border" />
      </div>

      <div className="h-72 rounded-[14px] bg-border" />
    </div>
  );
}

export default PageLoader;
