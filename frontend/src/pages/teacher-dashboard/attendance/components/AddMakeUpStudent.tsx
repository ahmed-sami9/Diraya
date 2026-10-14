import { useId, useState } from 'react';

import type { AttendanceGroupOption, SheetStudent } from '../../../../api/attendance/attendance';
import PlusIcon from '../../../../components/icons/PlusIcon';
import { secondaryButtonClasses } from '../../../../components/formStyles';
import { useMakeUpCandidates } from '../../../../hooks/attendance/useMakeUpCandidates';

interface AddMakeUpStudentProps {
  gradeId: string;
  // This sheet's group: its own students are already listed.
  groupId: string;
  // The grade's groups, to show where each candidate normally attends.
  groups: AttendanceGroupOption[];
  // Already on the sheet (group members and make-ups): not offered again.
  onSheetIds: Set<string>;
  disabled: boolean;
  onAdd: (student: SheetStudent) => void;
}

// "+ Add a student": any student of the SAME grade who isn't on the sheet.
// Two cases:
//   - from another group: a make-up, attending this class instead of theirs
//   - from this group: a student registered after this day, being added to
//     an older sheet (they're hidden there by default, so nobody is marked
//     for a class before they joined by accident)
// Only same-grade students are offered, the same rule the database enforces.
// The server decides "make-up" itself when saving (their group vs this one).
function AddMakeUpStudent({
  gradeId,
  groupId,
  groups,
  onSheetIds,
  disabled,
  onAdd,
}: AddMakeUpStudentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pickedId, setPickedId] = useState('');
  const selectId = useId();

  const candidates = useMakeUpCandidates(gradeId, isOpen);

  const groupName = (id: string) => groups.find((group) => group.id === id)?.name ?? '';

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="flex h-11 items-center gap-2 rounded-[10px] px-2 text-sm font-semibold text-primary hover:bg-primary-tint disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <PlusIcon className="h-4 w-4" />
        Add a student
      </button>
    );
  }

  const options =
    candidates.status === 'ready'
      ? candidates.students.filter((student) => !onSheetIds.has(student.id))
      : [];

  const handleAdd = () => {
    const student = options.find((item) => item.id === pickedId);
    if (!student) return;

    onAdd({
      id: student.id,
      code: student.code,
      name: student.name,
      isMakeUp: student.groupId !== groupId,
      groupName: groupName(student.groupId),
      status: null,
      reason: null,
    });
    setPickedId('');
    setIsOpen(false);
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-page p-3 sm:flex-row sm:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label
          htmlFor={selectId}
          className="text-[13px] font-semibold text-ink"
        >
          Student of this grade, not on this sheet
        </label>
        <select
          id={selectId}
          value={pickedId}
          onChange={(event) => setPickedId(event.target.value)}
          disabled={candidates.status !== 'ready' || options.length === 0}
          className="h-11 w-full cursor-pointer rounded-[10px] border border-border bg-surface px-3 text-sm text-ink outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-tint disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">
            {candidates.status === 'loading' || candidates.status === 'idle'
              ? 'Loading students…'
              : candidates.status === 'error'
                ? 'Couldn’t load students'
                : options.length === 0
                  ? 'Everyone in this grade is on the sheet'
                  : 'Choose a student'}
          </option>
          {options.map((student) => (
            <option
              key={student.id}
              value={student.id}
            >
              {student.name} · {student.code} · {groupName(student.groupId)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className={secondaryButtonClasses}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!pickedId}
          className={`${secondaryButtonClasses} text-primary`}
        >
          Add
        </button>
      </div>
    </div>
  );
}

export default AddMakeUpStudent;
