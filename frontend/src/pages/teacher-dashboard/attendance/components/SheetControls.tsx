import { useId } from 'react';

import type { AttendanceGradeOption, IsoDay } from '../../../../api/attendance/attendance';

interface SheetControlsProps {
  grades: AttendanceGradeOption[];
  gradeId: string;
  groupId: string;
  date: IsoDay;
  // The latest day that can be picked: today in Egypt.
  maxDate: IsoDay;
  disabled: boolean;
  // One callback for all three: the page decides whether to ask about
  // unsaved changes first.
  onChange: (next: { groupId: string; date: IsoDay }) => void;
}

const fieldClasses = `
  h-11 w-full rounded-[10px] border border-border bg-surface px-3
  text-sm font-semibold text-ink
  cursor-pointer outline-none
  focus:border-primary focus:ring-[3px] focus:ring-primary-tint
  disabled:cursor-not-allowed disabled:opacity-60
`;

// Which sheet: grade, group and day. Native <select> and <input type="date">
// on purpose: the phone's own pickers, keyboard and screen readers for free.
function SheetControls({
  grades,
  gradeId,
  groupId,
  date,
  maxDate,
  disabled,
  onChange,
}: SheetControlsProps) {
  const gradeFieldId = useId();
  const groupFieldId = useId();
  const dateFieldId = useId();

  const groups = grades.find((grade) => grade.id === gradeId)?.groups ?? [];

  return (
    // Stacked on phones, three columns from tablet width.
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={gradeFieldId}
          className="text-xs font-semibold uppercase tracking-wide text-ink-muted"
        >
          Grade
        </label>
        <select
          id={gradeFieldId}
          value={gradeId}
          disabled={disabled}
          // A new grade opens on its first group.
          onChange={(event) => {
            const firstGroup = grades.find((grade) => grade.id === event.target.value)?.groups[0];
            if (firstGroup) onChange({ groupId: firstGroup.id, date });
          }}
          className={fieldClasses}
        >
          {grades.map((grade) => (
            <option
              key={grade.id}
              value={grade.id}
              disabled={grade.groups.length === 0}
            >
              {grade.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={groupFieldId}
          className="text-xs font-semibold uppercase tracking-wide text-ink-muted"
        >
          Group
        </label>
        <select
          id={groupFieldId}
          value={groupId}
          disabled={disabled}
          onChange={(event) => onChange({ groupId: event.target.value, date })}
          className={fieldClasses}
        >
          {groups.map((group) => (
            <option
              key={group.id}
              value={group.id}
            >
              {group.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={dateFieldId}
          className="text-xs font-semibold uppercase tracking-wide text-ink-muted"
        >
          Day
        </label>
        <input
          id={dateFieldId}
          type="date"
          value={date}
          max={maxDate}
          required
          disabled={disabled}
          onChange={(event) => {
            // Clearing the field gives "": ignore it rather than load nothing.
            if (event.target.value) onChange({ groupId, date: event.target.value });
          }}
          className={fieldClasses}
        />
      </div>
    </div>
  );
}

export default SheetControls;
