import { useId, type ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  // Muted text after the title: "this term", "average 81%".
  subtitle?: string;
  // Top-right: usually a "See all" link.
  action?: ReactNode;
  children: ReactNode;
}

// The white card every profile section sits in. The heading names the
// section for screen readers too (aria-labelledby), so each card is a
// landmark a keyboard user can jump to.
function SectionCard({ title, subtitle, action, children }: SectionCardProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id={headingId}
          className="text-[17px] font-bold text-ink"
        >
          {title}
          {subtitle && <span className="text-sm font-medium text-ink-muted"> · {subtitle}</span>}
        </h2>
        {action}
      </div>

      {children}
    </section>
  );
}

export default SectionCard;
