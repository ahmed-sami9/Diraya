import type { GroupSummary } from '../../../../../api/students/groups';
import PlusIcon from '../../../../../components/icons/PlusIcon';

// Which students the table shows: everyone, or one group. (Every student is
// in a group, so there is no "no group" choice.)
export type GroupFilterValue = 'all' | { groupId: string };

interface GroupFilterProps {
  groups: GroupSummary[];
  // How many students each choice holds, counted from the student list.
  totalCount: number;
  countsByGroup: Map<string, number>;
  value: GroupFilterValue;
  onChange: (value: GroupFilterValue) => void;
  onAddGroup: () => void;
}

const isSelected = (value: GroupFilterValue, option: GroupFilterValue) =>
  typeof value === 'string' || typeof option === 'string'
    ? value === option
    : value.groupId === option.groupId;

// The row of group buttons above the table: a name and a count each, nothing
// more, so the groups themselves stay the thing the eye lands on. Schedules
// belong to the group's own view, not to a filter button.
//
// They are toggle buttons (aria-pressed), not ARIA tabs: tabs promise
// separate panels and arrow-key navigation, while this filters one list.
function GroupFilter({
  groups,
  totalCount,
  countsByGroup,
  value,
  onChange,
  onAddGroup,
}: GroupFilterProps) {
  const options: { key: string; value: GroupFilterValue; label: string; count: number }[] = [
    { key: 'all', value: 'all', label: 'All students', count: totalCount },
    ...groups.map((group) => ({
      key: group.id,
      value: { groupId: group.id },
      label: group.name,
      count: countsByGroup.get(group.id) ?? 0,
    })),
  ];

  return (
    <div
      role="group"
      aria-label="Show students by group"
      // One scrolling row on phones, wrapping rows from tablet width up.
      className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
    >
      {options.map((option) => {
        const selected = isSelected(value, option.value);

        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`
              flex h-11 shrink-0 items-center gap-2
              rounded-[10px] border px-4
              text-sm
              cursor-pointer
              transition-colors
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
              ${
                selected
                  ? 'border-primary bg-primary-tint font-bold text-primary'
                  : 'border-border bg-page font-semibold text-ink hover:bg-surface'
              }
            `}
          >
            <span className="max-w-[180px] truncate">{option.label}</span>
            <span
              className={`
                min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs tabular-nums
                ${selected ? 'bg-primary/10 font-semibold text-primary' : 'bg-border/60 font-medium text-ink-muted'}
              `}
            >
              {option.count}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={onAddGroup}
        className="
          flex h-11 shrink-0 items-center gap-1.5
          rounded-[10px] border border-dashed border-ink-muted/40 px-3.5
          text-sm font-semibold text-ink-secondary
          cursor-pointer
          transition-colors
          hover:border-primary hover:text-primary
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
        "
      >
        <PlusIcon className="h-4 w-4" />
        Group
      </button>
    </div>
  );
}

export default GroupFilter;
