import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface SummaryTileProps {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  /** Where the tile leads when clicked. */
  to: string;
}

/** One headline number at the top of the Home page. The whole tile is a link. */
function SummaryTile({ label, value, hint, icon, to }: SummaryTileProps) {
  return (
    <Link
      to={to}
      className="
        flex flex-col gap-1.5
        rounded-[14px] border border-border bg-surface
        px-5 py-[18px]
        transition-colors
        hover:border-primary/40
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
      "
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink-secondary">{label}</span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-tint text-primary">
          {icon}
        </span>
      </span>

      <span className="text-3xl font-bold leading-tight text-ink">{value}</span>
      <span className="text-[13px] text-ink-secondary">{hint}</span>
    </Link>
  );
}

export default SummaryTile;
