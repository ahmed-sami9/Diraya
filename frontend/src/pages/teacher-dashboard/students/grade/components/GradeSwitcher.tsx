import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';

import { isAbortError } from '../../../../../api/apiClient';
import { getGrades, type GradeSummary } from '../../../../../api/students/grades';
import CheckCircleIcon from '../../../../../components/icons/CheckCircleIcon';

interface GradeSwitcherProps {
  currentGradeId: string;
  currentGradeName: string;
}

// The grade name in the breadcrumb, as a menu: jump to another grade without
// going back to the Students page first.
//
// The list of grades is fetched the first time the menu opens, not with the
// page: most visits never open it, so most visits never pay for it.
function GradeSwitcher({ currentGradeId, currentGradeName }: GradeSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [grades, setGrades] = useState<GradeSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load once, on first open.
  useEffect(() => {
    if (!isOpen || grades) return;

    const controller = new AbortController();

    getGrades(controller.signal)
      .then((list) => {
        setGrades(list);
        setFailed(false);
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        console.error(error);
        setFailed(true);
      });

    return () => controller.abort();
  }, [isOpen, grades]);

  // Focus the current grade when the list is there; close on outside click.
  useEffect(() => {
    if (!isOpen) return;

    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    const current = menuRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    (current ?? items?.[0])?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen, grades]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    );
    const index = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'Tab') {
      setIsOpen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative min-w-0"
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={`${currentGradeName}, switch grade`}
        className="
          flex h-9 min-w-0 max-w-full items-center gap-1.5
          rounded-lg border border-border bg-surface px-2.5
          text-sm font-semibold text-ink
          cursor-pointer
          transition-colors
          hover:bg-surface-hover
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
        "
      >
        <span className="truncate">{currentGradeName}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`h-3.5 w-3.5 shrink-0 text-ink-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Your grades"
          onKeyDown={handleMenuKeyDown}
          className="
            absolute left-0 top-[calc(100%+6px)] z-30
            max-h-80 w-64 overflow-y-auto p-1.5
            rounded-xl border border-border bg-surface
            shadow-lg shadow-ink/10
            transition-[opacity,translate] duration-150
            starting:-translate-y-1 starting:opacity-0
            motion-reduce:transition-none
          "
        >
          {!grades && !failed && <p className="px-3 py-2.5 text-sm text-ink-muted">Loading…</p>}

          {failed && (
            <p className="px-3 py-2.5 text-sm text-ink-secondary">Couldn’t load your grades.</p>
          )}

          {grades?.map((grade) => {
            const isCurrent = grade.id === currentGradeId;

            return (
              <Link
                key={grade.id}
                to={`/teacher/students/grades/${grade.id}`}
                role="menuitem"
                aria-current={isCurrent ? 'page' : undefined}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center justify-between gap-2
                  rounded-lg px-3 py-2.5
                  text-sm
                  focus-visible:outline-none
                  hover:bg-surface-hover focus-visible:bg-surface-hover
                  ${isCurrent ? 'font-semibold text-primary' : 'font-medium text-ink'}
                `}
              >
                <span className="truncate">{grade.name}</span>
                {isCurrent ? (
                  <CheckCircleIcon className="h-4 w-4 shrink-0" />
                ) : (
                  <span className="shrink-0 text-xs text-ink-muted">{grade.studentCount}</span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default GradeSwitcher;
