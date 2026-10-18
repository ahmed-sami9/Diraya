import { addMonths, formatMonth, type IsoMonth } from '../paymentsHelpers';

// ‹ October 2026 ›, shared by the payments pages. The future has nothing
// collected yet, so the page decides whether › is allowed.
function MonthSwitcher({
  month,
  canGoForward,
  onChange,
}: {
  month: IsoMonth;
  canGoForward: boolean;
  onChange: (month: IsoMonth) => void;
}) {
  const arrow = `
    flex h-9 w-9 items-center justify-center rounded-lg text-ink-secondary
    cursor-pointer transition-colors hover:bg-surface-hover hover:text-ink
    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
    disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent
  `;

  return (
    <div
      role="group"
      aria-label="Month"
      className="flex h-11 items-center gap-1 rounded-[10px] border border-border bg-surface px-1"
    >
      <button
        type="button"
        aria-label="Previous month"
        onClick={() => onChange(addMonths(month, -1))}
        className={arrow}
      >
        <span aria-hidden="true">‹</span>
      </button>
      {/* aria-live: screen readers hear the new month after an arrow. */}
      <span
        aria-live="polite"
        className="min-w-[120px] text-center text-sm font-bold text-ink"
      >
        {formatMonth(month)}
      </span>
      <button
        type="button"
        aria-label="Next month"
        // The future has nothing collected yet.
        disabled={!canGoForward}
        onClick={() => onChange(addMonths(month, 1))}
        className={arrow}
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}

export default MonthSwitcher;
