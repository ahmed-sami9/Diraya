import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import MoreHorizontalIcon from '../../../../components/icons/MoreHorizontalIcon';
import PencilIcon from '../../../../components/icons/PencilIcon';
import TrashIcon from '../../../../components/icons/TrashIcon';

interface GradeOptionsMenuProps {
  gradeName: string;
  onEdit: () => void;
  onDelete: () => void;
}

// The "⋯" button on a grade card and the small menu it opens.
//
// Built as an accessible menu button:
//   - the button says whether the menu is open (aria-expanded)
//   - opening moves focus to the first item; Arrow keys move between items
//   - Escape, a click outside, or choosing an item closes it
function GradeOptionsMenu({ gradeName, onEdit, onDelete }: GradeOptionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = (returnFocus: boolean) => {
    setIsOpen(false);

    if (returnFocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!isOpen) return;

    // Focus the first item, so keyboard users land inside the menu.
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    );
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(currentIndex + 1) % items.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'Tab') {
      // Tabbing away closes the menu instead of leaving it open behind.
      setIsOpen(false);
    }
  };

  const choose = (action: () => void) => {
    // Don't return focus to the button: the action opens a dialog, and the
    // dialog takes focus (and gives it back when it closes).
    close(false);
    action();
  };

  const itemClasses = `
    flex w-full items-center gap-2.5
    rounded-lg px-3 py-2.5
    text-left text-sm font-medium
    cursor-pointer
    focus-visible:outline-none
  `;

  return (
    // relative z-10: sits above the card's full-size link, so clicking the
    // button opens the menu instead of opening the grade.
    <div
      ref={containerRef}
      className="relative z-10 -mr-3 -mt-2.5"
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={`Options for ${gradeName}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        className="
          flex h-11 w-11 items-center justify-center
          rounded-[10px] text-ink-secondary
          cursor-pointer
          transition-colors
          hover:bg-surface-hover hover:text-ink
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
        "
      >
        <MoreHorizontalIcon className="h-5 w-5" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`Options for ${gradeName}`}
          onKeyDown={handleMenuKeyDown}
          className="
            absolute right-0 top-12 z-20
            w-44 p-1.5
            rounded-xl border border-border bg-surface
            shadow-lg shadow-ink/10
            transition-[opacity,translate] duration-150
            starting:opacity-0 starting:-translate-y-1
            motion-reduce:transition-none
          "
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => choose(onEdit)}
            className={`${itemClasses} text-ink hover:bg-surface-hover focus-visible:bg-surface-hover`}
          >
            <PencilIcon className="h-4 w-4 text-ink-secondary" />
            Edit
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => choose(onDelete)}
            className={`${itemClasses} text-danger hover:bg-danger-tint focus-visible:bg-danger-tint`}
          >
            <TrashIcon className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default GradeOptionsMenu;
