import ChevronRightIcon from '../../../../components/icons/ChevronRightIcon';
import PlusIcon from '../../../../components/icons/PlusIcon';

interface GradesEmptyStateProps {
  onAddGrade: () => void;
}

// The three levels a new teacher needs to understand, with an example each.
const steps = [
  { label: '1 · Grade', example: 'Grade 3 Secondary' },
  { label: '2 · Groups', example: 'Group A · Sat 4:00 pm' },
  { label: '3 · Students', example: 'Omar, Salma, Youssef…' },
];

// What the Students page shows before the teacher has any grades.
// It explains the Grade -> Group -> Student structure and offers one action.
function GradesEmptyState({ onAddGrade }: GradesEmptyStateProps) {
  return (
    <section
      aria-labelledby="grades-empty-title"
      className="
        flex flex-col items-center
        rounded-[14px] border border-border bg-surface
        px-6 py-12 text-center
      "
    >
      {/* Illustration: a grade card being added. Decorative only. */}
      <div
        aria-hidden="true"
        className="relative h-[150px] w-[200px]"
      >
        <div className="absolute left-5 top-2 h-[134px] w-40 rounded-full bg-primary-tint" />
        <div className="absolute left-12 top-[22px] h-20 w-[116px] -rotate-8 rounded-[14px] bg-primary/15" />
        <div
          className="
            absolute left-10 top-[38px]
            flex h-[86px] w-[124px] flex-col gap-2
            rounded-[14px] border border-primary/15 bg-surface p-3.5
            shadow-[0_10px_24px_rgba(52,49,228,0.16)]
          "
        >
          <div className="h-[9px] w-16 rounded-full bg-primary" />
          <div className="h-[7px] w-[88px] rounded-full bg-border" />
          <div className="mt-1 flex">
            <span className="h-5 w-5 rounded-full border-2 border-surface bg-primary/30" />
            <span className="-ml-[7px] h-5 w-5 rounded-full border-2 border-surface bg-primary/20" />
            <span className="-ml-[7px] h-5 w-5 rounded-full border-2 border-surface bg-primary-tint" />
          </div>
        </div>
        <div
          className="
            absolute left-[146px] top-[104px]
            flex h-[38px] w-[38px] items-center justify-center
            rounded-full border-[3px] border-surface bg-primary text-white
          "
        >
          <PlusIcon className="h-[18px] w-[18px]" />
        </div>
      </div>

      <h2
        id="grades-empty-title"
        className="mt-5 text-[22px] font-bold text-ink"
      >
        No grades yet
      </h2>
      <p className="mt-1.5 max-w-[440px] text-[15px] text-ink-secondary">
        Create your first grade, like “Grade 3 Secondary”. Then add groups to it, and students to
        each group.
      </p>

      <ol
        aria-label="How students are organised"
        className="mt-7 flex flex-wrap items-stretch justify-center gap-2.5"
      >
        {steps.map((step, index) => (
          <li
            key={step.label}
            className="flex items-center gap-2.5"
          >
            <span
              className="
                flex min-w-[170px] flex-col items-start gap-0.5
                rounded-xl border border-primary/15 bg-primary-tint/50
                px-3.5 py-3 text-left
              "
            >
              <span className="text-xs font-bold text-primary">{step.label}</span>
              <span className="text-sm font-semibold text-ink">{step.example}</span>
            </span>

            {index < steps.length - 1 && (
              <ChevronRightIcon className="hidden h-[18px] w-[18px] text-ink-muted sm:block" />
            )}
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={onAddGrade}
        className="
          mt-7 flex h-11 items-center gap-2
          rounded-[10px] bg-primary px-5
          text-sm font-semibold text-white
          cursor-pointer
          transition-colors
          hover:bg-primary-hover
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
        "
      >
        <PlusIcon className="h-[18px] w-[18px]" />
        Add your first grade
      </button>
    </section>
  );
}

export default GradesEmptyState;
