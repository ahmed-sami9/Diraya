import { useId, useRef, useState } from 'react';

import type { GroupSummary } from '../../../../../api/students/groups';
import DialogShell from '../../../../../components/DialogShell';
import AlertTriangleIcon from '../../../../../components/icons/AlertTriangleIcon';
import {
  dangerButtonClasses,
  formErrorClasses,
  inputClasses,
  secondaryButtonClasses,
} from '../../../../../components/formStyles';
import { pluralize } from '../../../../../utils/formatSession';

interface DeleteGroupDialogProps {
  group: GroupSummary;
  studentCount: number;
  // The grade's other groups: where this group's students can go.
  otherGroups: GroupSummary[];
  // Deletes on the server, moving the students to `moveStudentsTo` first
  // (null when there are no students). Throws if the server refuses.
  onConfirm: (moveStudentsTo: string | null) => Promise<void>;
  onClose: () => void;
}

// Asks before deleting a group. Three cases, because a group is the class
// its students belong to:
//
//   - the grade's only group: can't be deleted (a grade always keeps one,
//     so "Add student" always has somewhere to put them). Says so, and
//     suggests renaming instead.
//   - a group with students: they need a new group first. The teacher picks
//     one, and the server moves them and deletes the group in one step.
//   - an empty group: a plain "are you sure?".
function DeleteGroupDialog({
  group,
  studentCount,
  otherGroups,
  onConfirm,
  onClose,
}: DeleteGroupDialogProps) {
  const [moveTo, setMoveTo] = useState(otherGroups[0]?.id ?? '');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectId = useId();

  // Focus starts on Cancel, the safe choice.
  const cancelRef = useRef<HTMLButtonElement>(null);

  const isLastGroup = otherGroups.length === 0;
  const hasStudents = studentCount > 0;

  const requestClose = () => {
    if (!isDeleting) onClose();
  };

  const handleDelete = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    setError(null);

    try {
      await onConfirm(hasStudents ? moveTo : null);
      onClose();
    } catch (caught) {
      console.error(caught);

      // The server's message is written for the teacher ("The group you
      // picked no longer exists."), so it's shown as is.
      setError(
        caught instanceof Error ? caught.message : 'Something went wrong. Please try again.'
      );
      setIsDeleting(false);
    }
  };

  const description = isLastGroup
    ? `It’s the only group in this grade, and every grade needs at least one. Rename it instead if the name is wrong.`
    : hasStudents
      ? `Its ${pluralize(studentCount, 'student')} will move to the group you pick below. Their past attendance stays as it is.`
      : 'This group has no students. Deleting it can’t be undone.';

  return (
    <DialogShell
      role="alertdialog"
      title={isLastGroup ? `${group.name} can’t be deleted` : `Delete ${group.name}?`}
      description={description}
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

      {!isLastGroup && hasStudents && (
        <div className="mb-5 flex flex-col gap-1.5">
          <label
            htmlFor={selectId}
            className="text-sm font-semibold text-ink"
          >
            Move {studentCount === 1 ? 'the student' : 'the students'} to
          </label>
          <select
            id={selectId}
            value={moveTo}
            onChange={(event) => setMoveTo(event.target.value)}
            disabled={isDeleting}
            className={`${inputClasses(false)} cursor-pointer`}
          >
            {otherGroups.map((other) => (
              <option
                key={other.id}
                value={other.id}
              >
                {other.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2.5">
        <button
          ref={cancelRef}
          type="button"
          onClick={requestClose}
          disabled={isDeleting}
          className={secondaryButtonClasses}
        >
          {isLastGroup ? 'Close' : 'Cancel'}
        </button>

        {!isLastGroup && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-busy={isDeleting}
            className={dangerButtonClasses}
          >
            {isDeleting ? 'Deleting…' : hasStudents ? 'Move and delete' : 'Delete group'}
          </button>
        )}
      </div>
    </DialogShell>
  );
}

export default DeleteGroupDialog;
