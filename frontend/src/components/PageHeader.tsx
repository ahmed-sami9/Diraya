import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description: ReactNode;
  // Buttons or controls on the right; they drop under the title on phones.
  actions?: ReactNode;
}

// The title block at the top of every dashboard section. One component, so
// every page's heading has the same size, spacing and place.
function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
        <p className="text-sm text-ink-secondary">{description}</p>
      </div>
      {actions}
    </header>
  );
}

export default PageHeader;
