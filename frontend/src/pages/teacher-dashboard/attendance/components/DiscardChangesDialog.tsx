import { useRef } from 'react';

import DialogShell from '../../../../components/DialogShell';
import { dangerButtonClasses, secondaryButtonClasses } from '../../../../components/formStyles';

interface DiscardChangesDialogProps {
  onDiscard: () => void;
  onKeep: () => void;
}

// Asked before switching group or day with unsaved marks: switching would
// quietly throw them away otherwise.
function DiscardChangesDialog({ onDiscard, onKeep }: DiscardChangesDialogProps) {
  // Focus starts on "Keep editing", the safe choice.
  const keepRef = useRef<HTMLButtonElement>(null);

  return (
    <DialogShell
      role="alertdialog"
      title="Discard unsaved marks?"
      description="You changed this sheet without saving. Switching now loses those changes."
      onRequestClose={onKeep}
      initialFocusRef={keepRef}
      maxWidthClassName="max-w-[420px]"
    >
      <div className="flex flex-wrap justify-end gap-2.5">
        <button
          ref={keepRef}
          type="button"
          onClick={onKeep}
          className={secondaryButtonClasses}
        >
          Keep editing
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className={dangerButtonClasses}
        >
          Discard
        </button>
      </div>
    </DialogShell>
  );
}

export default DiscardChangesDialog;
