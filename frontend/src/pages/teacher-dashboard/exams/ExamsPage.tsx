import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import type { ExamSummary } from '../../../api/exams/exams';
import SectionError from '../../../components/SectionError';
import ExamsIcon from '../../../components/icons/ExamsIcon';
import PlusIcon from '../../../components/icons/PlusIcon';
import { primaryButtonClasses } from '../../../components/formStyles';
import { useExams } from '../../../hooks/exams/useExams';
import { useGrades } from '../../../hooks/students/useGrades';
import { todayInCairo } from '../../../utils/cairoDate';

import ExamFormDialog from './components/ExamFormDialog';
import { MissingMarksBanner, PastExamsTable, UpcomingExams } from './components/ExamSections';
import { examsMissingMarks, upcomingExams } from './examHelpers';

/* ---------------------------------- Page ---------------------------------- */

// /teacher/exams?grade=1&new=1
//
// The exams "home": what's coming, what's done, and what still needs marks.
// The page owns the data, the filter and the dialog; the sections only display.
//
// Everything below the filter is DERIVED from one list: upcoming vs past
// from today's date, the banner from examsMissingMarks. Nothing is copied
// into extra state, so nothing can drift out of sync.
function ExamsPage() {
  const examsData = useExams();

  // The teacher's real grades, for the dialog's grade picker.
  const grades = useGrades();

  const [searchParams, setSearchParams] = useSearchParams();
  const today = todayInCairo();

  // Both the filter and the open dialog live in the URL:
  //   ?grade=1  a refresh, Back, or a shared link keeps the filter
  //   ?new=1    any button anywhere (the navbar's "Add exam") can open the
  //             dialog with a plain link, no shared state needed
  const updateParams = (change: (params: URLSearchParams) => void) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        change(next);
        return next;
      },
      // replace: filters and dialogs shouldn't fill the Back history.
      { replace: true }
    );
  };

  const hasGrades = grades.status === 'ready' && grades.grades.length > 0;
  // Only open once there are grades to pick from.
  const isAdding = searchParams.get('new') === '1' && hasGrades;

  const openAddExam = () => updateParams((params) => params.set('new', '1'));
  const closeAddExam = () => updateParams((params) => params.delete('new'));

  // Stable while the list hasn't changed, so the useMemos below don't redo
  // their work on every render.
  const exams = useMemo<ExamSummary[]>(
    () => (examsData.state.status === 'ready' ? examsData.state.exams : []),
    [examsData.state]
  );

  // The grades that have exams, in first-seen order: a chip for a grade
  // with nothing in it would only lead to an empty list.
  const examGrades = useMemo(() => {
    const byId = new Map<string, string>();
    for (const exam of exams) byId.set(exam.grade.id, exam.grade.name);
    return [...byId].map(([id, name]) => ({ id, name }));
  }, [exams]);

  // An unknown ?grade= (deleted grade, old link) falls back to "all".
  const gradeParam = searchParams.get('grade');
  const gradeId = examGrades.some((grade) => grade.id === gradeParam) ? gradeParam : null;

  const selectGrade = (id: string | null) =>
    updateParams((params) => (id ? params.set('grade', id) : params.delete('grade')));

  const { upcoming, past, missing } = useMemo(() => {
    const shown = gradeId ? exams.filter((exam) => exam.grade.id === gradeId) : exams;

    const upcoming = upcomingExams(shown, today);

    // ISO days compare correctly as plain strings.
    const past = shown
      .filter((exam) => exam.heldOn < today)
      .sort((a, b) => b.heldOn.localeCompare(a.heldOn)); // newest first

    const missing = examsMissingMarks(shown, today);

    return { upcoming, past, missing };
  }, [exams, gradeId, today]);

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Exams &amp; marks</h1>
          <p className="text-sm text-ink-secondary">
            Every exam and quiz you’ve set. Open one to see its results or enter marks.
          </p>
        </div>

        {/* Hidden while empty: the empty state has its own, bigger button,
            and two buttons doing the same thing on one screen is noise. */}
        {exams.length > 0 && (
          <button
            type="button"
            onClick={openAddExam}
            disabled={!hasGrades}
            className={`${primaryButtonClasses} flex items-center gap-2`}
          >
            <PlusIcon className="h-[18px] w-[18px]" />
            Add exam
          </button>
        )}
      </header>

      {examsData.state.status === 'error' ? (
        <SectionError
          title="We couldn’t load your exams"
          error={examsData.state.error}
          onRetry={examsData.reload}
        />
      ) : grades.status === 'error' ? (
        <SectionError
          title="We couldn’t load your grades"
          error={grades.loadError}
          onRetry={grades.reload}
        />
      ) : grades.status === 'loading' || examsData.state.status === 'loading' ? (
        // Both decide what to show (which empty state, or the list), so wait
        // for both. They load in parallel, and the header is already up.
        <div
          role="status"
          className="h-[260px] animate-pulse rounded-2xl border border-border bg-surface"
        >
          <span className="sr-only">Loading</span>
        </div>
      ) : exams.length === 0 ? (
        <ExamsEmptyState
          hasGrades={hasGrades}
          onAddExam={openAddExam}
        />
      ) : (
        <>
          {/* Only worth a filter when there's more than one grade. */}
          {examGrades.length > 1 && (
            <div
              role="group"
              aria-label="Show exams by grade"
              className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
            >
              {[{ id: null, name: 'All grades' }, ...examGrades].map((grade) => {
                const selected = grade.id === gradeId;

                return (
                  <button
                    key={grade.id ?? 'all'}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectGrade(grade.id)}
                    className={`
                      h-11 shrink-0 rounded-[10px] border px-4
                      text-sm cursor-pointer transition-colors
                      focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
                      ${
                        selected
                          ? 'border-primary bg-primary-tint font-bold text-primary'
                          : 'border-border bg-surface font-semibold text-ink hover:bg-surface-hover'
                      }
                    `}
                  >
                    {grade.name}
                  </button>
                );
              })}
            </div>
          )}

          {missing.length > 0 && <MissingMarksBanner exams={missing} />}

          <UpcomingExams
            exams={upcoming}
            today={today}
          />

          <PastExamsTable exams={past} />
        </>
      )}

      {isAdding && (
        <ExamFormDialog
          grades={grades.grades}
          defaultGradeId={gradeId}
          today={today}
          onSubmit={examsData.addExam}
          onClose={closeAddExam}
        />
      )}
    </div>
  );
}

// Two different "empty"s, because they need different next steps:
//   no grades yet -> an exam needs a grade, so send them to Students first
//   no exams yet  -> open the dialog right here
function ExamsEmptyState({ hasGrades, onAddExam }: { hasGrades: boolean; onAddExam: () => void }) {
  return (
    <section className="flex flex-col items-center rounded-2xl border border-border bg-surface px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-tint text-primary">
        <ExamsIcon className="h-6 w-6" />
      </span>

      {hasGrades ? (
        <>
          <h2 className="mt-4 text-lg font-bold text-ink">No exams yet</h2>
          <p className="mt-1.5 max-w-sm text-sm text-ink-secondary">
            Add an exam or a quiz for a grade. You’ll enter marks group by group after it’s held.
          </p>
          <button
            type="button"
            onClick={onAddExam}
            className={`${primaryButtonClasses} mt-5 flex items-center gap-2`}
          >
            <PlusIcon className="h-[18px] w-[18px]" />
            Add your first exam
          </button>
        </>
      ) : (
        <>
          <h2 className="mt-4 text-lg font-bold text-ink">Add a grade first</h2>
          <p className="mt-1.5 max-w-sm text-sm text-ink-secondary">
            Every exam belongs to a grade. Create one and add its students, then come back here.
          </p>
          <Link
            to="/teacher/students"
            className={`${primaryButtonClasses} mt-5 flex items-center`}
          >
            Go to Students
          </Link>
        </>
      )}
    </section>
  );
}

export default ExamsPage;
