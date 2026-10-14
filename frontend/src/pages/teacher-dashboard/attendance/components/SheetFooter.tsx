import type { AttendanceStatus } from '../../../../api/students/profile';
import { formErrorClasses, primaryButtonClasses } from '../../../../components/formStyles';
import { ATTENDANCE_STATUS } from '../../../../utils/attendanceStatus';

interface SheetFooterProps {
  counts: Record<AttendanceStatus, number>;
  canSave: boolean;
  isSaving: boolean;
  isDirty: boolean;
  isSaved: boolean;
  saveError: string | null;
  onSave: () => void;
}

const ORDER: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

// The bar at the bottom: the totals, then Save. It sticks to the bottom of
// the screen, so Save is always one tap away on a long list.
//
// The totals are there on purpose: everyone starts Present, so a teacher
// who presses Save without looking would record a full class. "28 present ·
// 2 absent" right next to the button makes them glance first.
function SheetFooter({
  counts,
  canSave,
  isSaving,
  isDirty,
  isSaved,
  saveError,
  onSave,
}: SheetFooterProps) {
  const summary = ORDER.filter((status) => counts[status] > 0 || status === 'present')
    .map((status) => `${counts[status]} ${ATTENDANCE_STATUS[status].label.toLowerCase()}`)
    .join(' · ');

  return (
    <div className="sticky bottom-0 z-10 -mx-4 border-t border-border-strong bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-b-2xl sm:px-5">
      {saveError && (
        <p
          role="alert"
          className={`${formErrorClasses} mb-3`}
        >
          {saveError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* aria-live: screen readers hear the totals change as marks change. */}
        <p
          aria-live="polite"
          className="text-sm font-semibold tabular-nums text-ink-secondary"
        >
          {summary}
          {isSaved && !isDirty && <span className="font-medium text-success"> · Saved</span>}
          {isDirty && <span className="font-medium text-warning"> · Unsaved changes</span>}
        </p>

        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || isSaving}
          aria-busy={isSaving}
          className={`${primaryButtonClasses} min-w-[140px] flex-1 sm:flex-none`}
        >
          {isSaving ? 'Saving…' : isSaved ? 'Save changes' : 'Save attendance'}
        </button>
      </div>
    </div>
  );
}

export default SheetFooter;
