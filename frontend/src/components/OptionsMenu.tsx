import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export type OptionsMenuItem = {
  label: string;
  icon?: ReactNode;
  // 'danger' for actions that delete something: shown in red.
  tone?: 'default' | 'danger';
  onSelect: () => void;
};

interface OptionsMenuProps {
  // Read by screen readers: "Options for Group A".
  label: string;
  // What the button shows: an icon, or an icon and text.
  trigger: ReactNode;
  items: OptionsMenuItem[];
  // Extra classes for the button (size, border...).
  buttonClassName?: string;
  // Which side the menu lines up with.
  align?: 'left' | 'right';
}

// A button that opens a short list of actions. A general version of the
// grade card's menu (GradeOptionsMenu), for any place that needs one.
//
// Accessible menu button:
//   - the button says whether the menu is open (aria-expanded)
//   - opening moves focus to the first item; Arrow keys move between items
//   - Escape, a click outside, Tab, or choosing an item closes it
function OptionsMenu({
  label,
  trigger,
  items,
  buttonClassName = '',
  align = 'right',
}: OptionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const menuItems = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    );
    const index = menuItems.indexOf(document.activeElement as HTMLElement);

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      menuItems[(index + 1) % menuItems.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      menuItems[(index - 1 + menuItems.length) % menuItems.length]?.focus();
    } else if (event.key === 'Tab') {
      setIsOpen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        className={`
          flex items-center justify-center gap-2
          cursor-pointer
          transition-colors
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
          ${buttonClassName}
        `}
      >
        {trigger}
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
          className={`
            absolute top-[calc(100%+6px)] z-30
            w-48 p-1.5
            rounded-xl border border-border bg-surface
            shadow-lg shadow-ink/10
            transition-[opacity,translate] duration-150
            starting:-translate-y-1 starting:opacity-0
            motion-reduce:transition-none
            ${align === 'right' ? 'right-0' : 'left-0'}
          `}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                // Focus isn't returned to the button: the action usually opens
                // a dialog, which takes focus and gives it back when it closes.
                setIsOpen(false);
                item.onSelect();
              }}
              className={`
                flex w-full items-center gap-2.5
                rounded-lg px-3 py-2.5
                text-left text-sm font-medium
                cursor-pointer
                focus-visible:outline-none
                ${
                  item.tone === 'danger'
                    ? 'text-danger hover:bg-danger-tint focus-visible:bg-danger-tint'
                    : 'text-ink hover:bg-surface-hover focus-visible:bg-surface-hover'
                }
              `}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default OptionsMenu;
