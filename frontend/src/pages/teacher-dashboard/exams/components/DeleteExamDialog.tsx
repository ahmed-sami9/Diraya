import { useRef, useState } from 'react';

import DialogShell from '../../../../components/DialogShell';
import AlertTriangleIcon from '../../../../components/icons/AlertTriangleIcon';
import {
  dangerButtonClasses,
  formErrorClasses,
  secondaryButtonClasses,
} from '../../../../components/formStyles';

interface DeleteExamDialogProps {
  title: string;
  // How many results would go with it, so the warning is concrete.
  resultCount: number;
  // Deletes on the server. Throws if it fails.
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

// Asks before deleting an exam. The warning names what is lost: an exam
// with marks takes them with it, and that can't be undone.
function DeleteExamDialog({ title, resultCount, onConfirm, onClose }: DeleteExamDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Focus starts on Cancel, the safe choice.
  const cancelRef = useRef<HTMLButtonElement>(null);

  const requestClose = () => {
    if (!isDeleting) onClose();
  };

  const handleDelete = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    setError(null);

    try {
      // The page navigates away after this, so the dialog doesn't close itself.
      await onConfirm();
    } catch (caught) {
      console.error(caught);
      setError(
        caught instanceof Error ? caught.message : 'Something went wrong. Please try again.'
      );
      setIsDeleting(false);
    }
  };

  return (
    <DialogShell
      role="alertdialog"
      title={`Delete ${title}?`}
      description={
        resultCount > 0
          ? `Its ${resultCount} ${resultCount === 1 ? 'result goes' : 'results go'} with it, and students’ averages change. This can’t be undone.`
          : 'No marks have been entered for it. This can’t be undone.'
      }
      onRequestClose={requestClose}
      isBusy={isDeleting}
      initialFocusRef={cancelRef}
      maxWidthClassName="max-w-[440px]"
      icon={
        <span
          aria-hidden="true"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-tint text-danger"
        >
          <AlertTriangleIcon className="h-5 w-5" />
        </span>
      }
    >
      {error && (
        <p
          role="alert"
          className={`${formErrorClasses} mb-4`}
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2.5">
        <button
          ref={cancelRef}
          type="button"
          onClick={requestClose}
          disabled={isDeleting}
          className={secondaryButtonClasses}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          aria-busy={isDeleting}
          className={dangerButtonClasses}
        >
          {isDeleting ? 'Deleting…' : 'Delete exam'}
        </button>
      </div>
    </DialogShell>
  );
}

export default DeleteExamDialog;
