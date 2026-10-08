import { useId, useRef, useState } from 'react';

import { ApiError } from '../../../../api/apiClient';
import type { GradeSummary } from '../../../../api/students/grades';
import AlertTriangleIcon from '../../../../components/icons/AlertTriangleIcon';
import useModalBehavior from '../../../../hooks/useModalBehavior';
import { pluralize } from '../../../../utils/formatSession';

interface DeleteGradeDialogProps {
  grade: GradeSummary;
  // Deletes on the server. Throws (ApiError) if the server refuses.
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

// Asks before deleting a grade.
//
// A grade that still has students can't be deleted: that would silently
// throw away their attendance, marks and payments. The dialog says so up
// front, and the server refuses it too (GRADE_HAS_STUDENTS) in case the
// page is out of date.
function DeleteGradeDialog({ grade, onConfirm, onClose }: DeleteGradeDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const hasStudents = grade.studentCount > 0;

  const requestClose = () => {
    if (!isDeleting) onClose();
  };

  // Focus starts on Cancel, the safe choice, so pressing Enter by habit
  // doesn't delete anything.
  const panelRef = useModalBehavior<HTMLDivElement>({
    onRequestClose: requestClose,
    initialFocusRef: cancelRef,
  });

  const handleDelete = async () => {
    if (isDeleting || hasStudents) return;

    setIsDeleting(true);
    setError(null);

    try {
      await onConfirm();
      onClose();
    } catch (caught) {
      console.error(caught);

      setError(
        caught instanceof ApiError && caught.code === 'GRADE_HAS_STUDENTS'
          ? 'This grade still has students. Move or remove them first, then delete the grade.'
          : caught instanceof Error
            ? caught.message
            : 'Something went wrong. Please try again.'
      );
      setIsDeleting(false);
    }
  };

  return (
    <div
      onClick={requestClose}
      className="
        fixed inset-0 z-50
        flex items-center justify-center
        bg-ink/40 px-4
        transition-opacity duration-200
        starting:opacity-0
        motion-reduce:transition-none
      "
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
        className="
          w-full max-w-[440px]
          rounded-2xl bg-surface p-6
          shadow-2xl shadow-ink/20
          transition-[opacity,scale] duration-200
          starting:scale-95 starting:opacity-0
          motion-reduce:transition-none
        "
      >
        <span
          aria-hidden="true"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-tint text-danger"
        >
          <AlertTriangleIcon className="h-5 w-5" />
        </span>

        <h2
          id={titleId}
          className="mt-4 text-[19px] font-bold text-ink"
        >
          Delete {grade.name}?
        </h2>

        <p
          id={descriptionId}
          className="mt-2 text-sm leading-relaxed text-ink-secondary"
        >
          {hasStudents
            ? `This grade still has ${pluralize(grade.studentCount, 'student')}. Move or remove them first, then you can delete the grade.`
            : 'This removes the grade and its groups. It can’t be undone.'}
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-danger/20 bg-danger-tint px-4 py-3 text-sm text-danger"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2.5">
          <button
            ref={cancelRef}
            type="button"
            onClick={requestClose}
            disabled={isDeleting}
            className="
              h-11 rounded-[10px] border border-border bg-surface px-[18px]
              text-sm font-semibold text-ink
              cursor-pointer
              hover:bg-surface-hover
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
              disabled:cursor-not-allowed disabled:opacity-60
            "
          >
            {hasStudents ? 'Close' : 'Cancel'}
          </button>

          {!hasStudents && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              aria-busy={isDeleting}
              className="
                h-11 rounded-[10px] bg-danger px-[18px]
                text-sm font-semibold text-white
                cursor-pointer
                transition-opacity
                hover:opacity-90
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger
                disabled:cursor-not-allowed disabled:opacity-70
              "
            >
              {isDeleting ? 'Deleting…' : 'Delete grade'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default DeleteGradeDialog;
