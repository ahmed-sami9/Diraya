import { useId, type ReactNode, type RefObject } from 'react';

import useModalBehavior from '../hooks/useModalBehavior';

import XIcon from './icons/XIcon';

interface DialogShellProps {
  title: string;
  description?: ReactNode;
  // Asked to close: Escape, the backdrop, or the × button. The dialog
  // decides whether it may close (not while saving, for example).
  onRequestClose: () => void;
  // Disables the × while something is being saved.
  isBusy?: boolean;
  // The element focused when the dialog opens (usually the first field).
  initialFocusRef?: RefObject<HTMLElement | null>;
  // 'alertdialog' for confirmations ("Delete this group?").
  role?: 'dialog' | 'alertdialog';
  // Optional icon above the title (the warning sign on delete dialogs).
  icon?: ReactNode;
  maxWidthClassName?: string;
  children: ReactNode;
}

// The frame every dialog shares: backdrop, panel, title, × button, the
// enter animation, and the keyboard rules from useModalBehavior (focus
// trap, Escape, scroll lock, focus returned on close).
//
// Each dialog only supplies its own content. One place to change how all
// dialogs look and behave. (The grade dialogs predate it and can move to it.)
function DialogShell({
  title,
  description,
  onRequestClose,
  isBusy = false,
  initialFocusRef,
  role = 'dialog',
  icon,
  maxWidthClassName = 'max-w-[480px]',
  children,
}: DialogShellProps) {
  const titleId = useId();
  const descriptionId = useId();

  const panelRef = useModalBehavior<HTMLDivElement>({ onRequestClose, initialFocusRef });

  return (
    <div
      onClick={onRequestClose}
      className="
        fixed inset-0 z-50
        flex items-end justify-center
        bg-ink/40 sm:items-center sm:px-4
        transition-opacity duration-200
        starting:opacity-0
        motion-reduce:transition-none
      "
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onClick={(event) => event.stopPropagation()}
        // Phones: a sheet from the bottom, the easiest place to reach with a
        // thumb. Larger screens: a centred card.
        className={`
          max-h-[92vh] w-full overflow-y-auto
          rounded-t-2xl bg-surface
          shadow-2xl shadow-ink/20
          transition-[opacity,translate,scale] duration-200
          starting:translate-y-6 starting:opacity-0
          sm:rounded-2xl sm:starting:translate-y-0 sm:starting:scale-95
          motion-reduce:transition-none
          ${maxWidthClassName}
        `}
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-6">
          <div className="min-w-0">
            {icon}
            <h2
              id={titleId}
              className={`text-[19px] font-bold text-ink ${icon ? 'mt-4' : ''}`}
            >
              {title}
            </h2>
            {description && (
              <div
                id={descriptionId}
                className="mt-1.5 text-sm leading-relaxed text-ink-secondary"
              >
                {description}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onRequestClose}
            disabled={isBusy}
            aria-label="Close"
            className="
              -mr-3 -mt-2
              flex h-11 w-11 shrink-0 items-center justify-center
              rounded-[10px] text-ink-secondary
              cursor-pointer
              hover:bg-surface-hover hover:text-ink
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
              disabled:cursor-not-allowed disabled:opacity-40
            "
          >
            <XIcon />
          </button>
        </div>

        <div className="px-6 pb-6 pt-5">{children}</div>
      </div>
    </div>
  );
}

export default DialogShell;
