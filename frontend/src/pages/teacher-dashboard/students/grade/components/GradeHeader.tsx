import type { GradeSummary } from '../../../../../api/students/grades';
import MoreHorizontalIcon from '../../../../../components/icons/MoreHorizontalIcon';
import PencilIcon from '../../../../../components/icons/PencilIcon';
import PlusIcon from '../../../../../components/icons/PlusIcon';
import TrashIcon from '../../../../../components/icons/TrashIcon';
import OptionsMenu from '../../../../../components/OptionsMenu';
import { getSessionLabel } from '../../../../../utils/formatSession';

interface GradeHeaderProps {
  grade: GradeSummary;
  // Counted from the lists on the page, so they update the moment a student
  // or group is added, without asking the server again.
  studentCount: number;
  groupCount: number;
  onAddStudent: () => void;
  onEditGrade: () => void;
  onDeleteGrade: () => void;
}

// The top card of the grade page: the grade's name and fee, its key numbers
// at a glance, and its actions.
//
// The numbers are the ones a teacher checks most, so often there is no need
// to open anything else. Attendance and payment numbers join them when those
// features exist.
function GradeHeader({
  grade,
  studentCount,
  groupCount,
  onAddStudent,
  onEditGrade,
  onDeleteGrade,
}: GradeHeaderProps) {
  const next = grade.nextSession ? getSessionLabel(grade.nextSession.startsAt) : null;

  // The fee isn't repeated here: the line under the title already says it.
  const stats = [
    { label: 'Students', value: String(studentCount) },
    { label: 'Groups', value: String(groupCount) },
  ];

  return (
    <section
      aria-labelledby="grade-title"
      className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1
            id="grade-title"
            className="break-words text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[30px]"
          >
            {grade.name}
          </h1>
          <p className="mt-1.5 text-[15px] text-ink-secondary">
            {grade.monthlyFee != null
              ? `${grade.monthlyFee.toLocaleString('en-GB')} EGP per month`
              : 'Uses your default monthly fee'}
          </p>
        </div>

        <div className="flex w-full items-center gap-2.5 sm:w-auto">
          <OptionsMenu
            label={`Options for ${grade.name}`}
            trigger={<MoreHorizontalIcon className="h-5 w-5" />}
            buttonClassName="h-11 w-11 rounded-[10px] border border-border bg-surface text-ink-secondary hover:bg-surface-hover hover:text-ink"
            align="left"
            items={[
              {
                label: 'Edit grade',
                icon: <PencilIcon className="h-4 w-4 text-ink-secondary" />,
                onSelect: onEditGrade,
              },
              {
                label: 'Delete grade',
                icon: <TrashIcon className="h-4 w-4" />,
                tone: 'danger',
                onSelect: onDeleteGrade,
              },
            ]}
          />

          {/* Full width on phones: the one main action, easy to reach. */}
          <button
            type="button"
            onClick={onAddStudent}
            className="
              flex h-11 flex-1 items-center justify-center gap-2
              rounded-[10px] bg-primary px-[18px]
              text-sm font-semibold text-white
              cursor-pointer
              transition-colors
              hover:bg-primary-hover
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
              sm:flex-none
            "
          >
            <PlusIcon className="h-[18px] w-[18px]" />
            Add student
          </button>
        </div>
      </div>

      {/* A description list: each number is a term (label) and its value. */}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-1 rounded-xl bg-page px-4 py-3.5"
          >
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {stat.label}
            </dt>
            <dd className="text-[22px] font-bold text-ink">{stat.value}</dd>
          </div>
        ))}

        <div className="col-span-2 flex flex-col gap-1 rounded-xl bg-primary-tint px-4 py-3.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-primary">
            Next session
          </dt>
          <dd className="text-[17px] font-bold leading-snug text-ink">
            {next && grade.nextSession
              ? `${next.day} ${next.time} · ${grade.nextSession.groupName}`
              : 'No sessions scheduled'}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export default GradeHeader;
