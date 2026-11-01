import { useRef, useState } from 'react';

import { ApiError } from '../../../../../api/apiClient';
import DialogShell from '../../../../../components/DialogShell';
import AlertTriangleIcon from '../../../../../components/icons/AlertTriangleIcon';
import {
  dangerButtonClasses,
  formErrorClasses,
  secondaryButtonClasses,
} from '../../../../../components/formStyles';
import { formatMoney } from '../profileFormat';
import type { StudentProfileData } from '../profileTypes';

interface DeleteStudentDialogProps {
  data: StudentProfileData;
  // Deletes on the server. Throws (ApiError) if the server refuses.
  onConfirm: (withPayments: boolean) => Promise<void>;
  onClose: () => void;
}

// Asks before deleting a student: everything of theirs goes with them. If
// they still owe money, that's said plainly, since the debt goes too.
//
// The server still asks for agreement when payments exist (withPayments), so
// a payment recorded after this page loaded can't be deleted unseen.
function DeleteStudentDialog({ data, onConfirm, onClose }: DeleteStudentDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelRef = useRef<HTMLButtonElement>(null);
  const { profile, payments } = data;
  const firstName = profile.name.split(' ')[0];

  const hasPayments = payments.some((month) => month.amountPaid > 0);
  // Owed = months up to this one; a month paid ahead isn't owed yet.
  const thisMonth = profile.summary.currentFee?.month;
  const owed = payments
    .filter((month) => !thisMonth || month.month <= thisMonth)
    .reduce((sum, month) => sum + Math.max(month.amountDue - month.amountPaid, 0), 0);

  const canDelete = !isDeleting;

  const requestClose = () => {
    if (!isDeleting) onClose();
  };

  const handleDelete = async () => {
    if (!canDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      // The page moves to the grade on success, so there's nothing to reset.
      await onConfirm(hasPayments);
    } catch (caught) {
      console.error(caught);

      setError(
        caught instanceof ApiError && caught.code === 'STUDENT_HAS_PAYMENTS'
          ? 'A payment was recorded for this student after this page loaded. Reload the page to see it before deleting.'
          : caught instanceof Error
            ? caught.message
            : 'Something went wrong. Please try again.'
      );
      setIsDeleting(false);
    }
  };

  return (
    <DialogShell
      role="alertdialog"
      title={`Delete ${profile.name}?`}
      description={`All of ${firstName}’s data goes with them: attendance, marks, payments and notes. This can’t be undone.`}
      onRequestClose={requestClose}
      isBusy={isDeleting}
      initialFocusRef={cancelRef}
      maxWidthClassName="max-w-[480px]"
      icon={
        <span
          aria-hidden="true"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-tint text-danger"
        >
          <AlertTriangleIcon className="h-5 w-5" />
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <p
            role="alert"
            className={formErrorClasses}
          >
            {error}
          </p>
        )}

        {owed > 0 && (
          <p className="rounded-xl border border-danger/30 bg-danger-tint px-4 py-3.5 text-sm text-ink">
            <strong className="block text-[15px] text-danger">
              {firstName} still owes {formatMoney(owed)}.
            </strong>
            Deleting them deletes this debt too: it won’t be tracked anywhere.
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
            disabled={!canDelete}
            aria-busy={isDeleting}
            className={dangerButtonClasses}
          >
            {isDeleting ? 'Deleting…' : 'Delete student'}
          </button>
        </div>
      </div>
    </DialogShell>
  );
}

export default DeleteStudentDialog;
