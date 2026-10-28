interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onClose: () => void;
}

/**
 * "Note deleted · Undo" at the bottom of the screen. role="status" so
 * screen readers announce it without stealing focus. The page decides how
 * long it stays and what happens when it goes.
 */
function UndoToast({ message, onUndo, onClose }: UndoToastProps) {
  return (
    <div
      role="status"
      className="
        fixed inset-x-4 bottom-5 z-50 mx-auto flex max-w-sm items-center gap-3
        rounded-xl bg-ink px-4 py-3 text-sm text-surface shadow-lg
        sm:inset-x-auto sm:left-1/2 sm:w-max sm:-translate-x-1/2
      "
    >
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onUndo}
        className="cursor-pointer rounded-md px-2 py-1 font-bold text-primary-tint hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-tint"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="cursor-pointer rounded-md px-1.5 py-1 text-surface/70 hover:bg-white/10 hover:text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-tint"
      >
        ✕
      </button>
    </div>
  );
}

export default UndoToast;
