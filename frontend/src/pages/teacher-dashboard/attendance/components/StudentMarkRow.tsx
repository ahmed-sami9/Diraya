import { useId } from 'react';

import type { SheetStudent } from '../../../../api/attendance/attendance';
import type { AttendanceStatus } from '../../../../api/students/profile';
import MoreHorizontalIcon from '../../../../components/icons/MoreHorizontalIcon';
import XIcon from '../../../../components/icons/XIcon';
import OptionsMenu from '../../../../components/OptionsMenu';
import type { DraftMark } from '../../../../hooks/attendance/useAttendanceSheet';
import { ATTENDANCE_STATUS } from '../../../../utils/attendanceStatus';
import { getInitials } from '../../../../utils/initials';

interface StudentMarkRowProps {
  student: SheetStudent;
  mark: DraftMark;
  // A make-up added in this visit (not saved yet): can be taken off again.
  isRemovable: boolean;
  disabled: boolean;
  onSetStatus: (status: AttendanceStatus) => void;
  onSetReason: (reason: string) => void;
  onRemove: () => void;
}

// The one tap: Present <-> Absent. Late and Excused are set from the "⋯"
// menu; tapping the big button on them goes back to Present.
const nextOnTap = (status: AttendanceStatus): AttendanceStatus =>
  status === 'present' ? 'absent' : 'present';

const STATUSES = Object.keys(ATTENDANCE_STATUS) as AttendanceStatus[];

// One student on the sheet: who they are, their mark, and (for absent or
// excused) an optional reason.
function StudentMarkRow({
  student,
  mark,
  isRemovable,
  disabled,
  onSetStatus,
  onSetReason,
  onRemove,
}: StudentMarkRowProps) {
  const reasonId = useId();
  const look = ATTENDANCE_STATUS[mark.status];
  const showsReason = mark.status === 'absent' || mark.status === 'excused';

  return (
    <li className="border-b border-border-strong px-4 py-3 last:border-b-0 sm:px-5">
      <div className="flex items-center gap-3">
        {/* The big target: the whole status pill. 44px tall for a thumb. */}
        <button
          type="button"
          onClick={() => onSetStatus(nextOnTap(mark.status))}
          disabled={disabled}
          // The name is in the label, so a screen reader hears who it is
          // AND what tapping will do.
          aria-label={`${student.name}: ${look.label}. Tap to mark ${ATTENDANCE_STATUS[nextOnTap(mark.status)].label.toLowerCase()}.`}
          className={`
            flex h-11 w-[112px] shrink-0 items-center justify-center gap-2 rounded-[10px]
            text-sm font-bold
            cursor-pointer transition-[transform,background-color] duration-150
            active:scale-[0.97]
            disabled:cursor-not-allowed disabled:opacity-60
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
            ${look.classes}
          `}
        >
          <span aria-hidden="true">{look.symbol}</span>
          {look.label}
        </button>

        <span
          aria-hidden="true"
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-[13px] font-bold text-primary sm:flex"
        >
          {getInitials(student.name)}
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-semibold text-ink">{student.name}</span>
          <span className="truncate text-[13px] text-ink-secondary">
            <span className="font-mono">{student.code}</span>
            {student.isMakeUp && (
              <span className="ml-2 rounded-full bg-primary-tint px-2 py-0.5 text-xs font-semibold text-primary">
                Make-up · {student.groupName}
              </span>
            )}
          </span>
        </span>

        {isRemovable && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label={`Take ${student.name} off this sheet`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-ink-muted hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <XIcon />
          </button>
        )}

        <OptionsMenu
          label={`More marks for ${student.name}`}
          trigger={<MoreHorizontalIcon className="h-[18px] w-[18px]" />}
          buttonClassName="h-11 w-11 shrink-0 rounded-[10px] text-ink-secondary hover:bg-surface-hover"
          items={STATUSES.map((status) => ({
            label: `${ATTENDANCE_STATUS[status].symbol}  ${ATTENDANCE_STATUS[status].label}`,
            onSelect: () => onSetStatus(status),
          }))}
        />
      </div>

      {showsReason && (
        <div className="mt-2 flex items-center gap-2 sm:pl-[160px]">
          <label
            htmlFor={reasonId}
            className="sr-only"
          >
            Reason for {student.name}
          </label>
          <input
            id={reasonId}
            type="text"
            value={mark.reason ?? ''}
            onChange={(event) => onSetReason(event.target.value)}
            disabled={disabled}
            maxLength={200}
            placeholder="Reason (optional), e.g. sick"
            className="h-10 w-full max-w-sm rounded-[10px] border border-border bg-surface px-3 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary focus:ring-[3px] focus:ring-primary-tint"
          />
        </div>
      )}
    </li>
  );
}

export default StudentMarkRow;
