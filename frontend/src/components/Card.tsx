import type { ReactNode } from 'react';

interface CardProps {
  title: string;
  /** Optional control shown at the right of the title, such as a "View all" link. */
  action?: ReactNode;
  children: ReactNode;
}

/** A titled white panel. Every dashboard section sits in one of these. */
function Card({ title, action, children }: CardProps) {
  return (
    <section className="rounded-[14px] border border-border bg-surface">
      <div className="flex min-h-[60px] items-center justify-between gap-3 px-5">
        <h2 className="text-[17px] font-bold text-ink">{title}</h2>
        {action}
      </div>

      <div className="border-t border-border">{children}</div>
    </section>
  );
}

export default Card;
