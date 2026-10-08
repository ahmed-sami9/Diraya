import { useState } from 'react';

import type { GradeSummary } from '../../../api/students/grades';
import PlusIcon from '../../../components/icons/PlusIcon';
import { useDelayedFlag } from '../../../hooks/useDelayedFlag';
import { useGrades } from '../../../hooks/students/useGrades';
import { pluralize } from '../../../utils/formatSession';

import GradeCard from './components/GradeCard';
import GradeFormDialog from './components/GradeFormDialog';
import DeleteGradeDialog from './components/DeleteGradeDialog';
import GradesEmptyState from './components/GradesEmptyState';

// Which dialog is open, and for which grade. One value instead of three
// booleans, so two dialogs can never be open at the same time.
type DialogState =
  | { type: 'create' }
  | { type: 'edit'; grade: GradeSummary }
  | { type: 'delete'; grade: GradeSummary }
  | null;

const primaryButtonClasses = `
  flex h-11 shrink-0 items-center gap-2
  rounded-[10px] bg-primary px-[18px]
  text-sm font-semibold text-white
  cursor-pointer
  transition-colors
  hover:bg-primary-hover
  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
`;

// Placeholder cards while the grades load. Only shown if loading takes more
// than a moment, so a fast answer never flashes a skeleton.
function GradesSkeleton() {
  const isVisible = useDelayedFlag(true);

  if (!isVisible) return null;

  return (
    <div
      role="status"
      className="grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      <span className="sr-only">Loading grades</span>
      {[0, 1, 2].map((key) => (
        <div
          key={key}
          className="h-[218px] rounded-[14px] border border-border bg-surface"
        />
      ))}
    </div>
  );
}

// The page the "Students" sidebar link opens: the teacher's grades.
// Opening a grade (its groups and student table) is the next page to build.
function StudentsPage() {
  const { grades, status, loadError, reload, addGrade, editGrade, removeGrade } = useGrades();
  const [dialog, setDialog] = useState<DialogState>(null);

  const closeDialog = () => setDialog(null);

  const hasGrades = status === 'ready' && grades.length > 0;
  const studentTotal = grades.reduce((sum, grade) => sum + grade.studentCount, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Heading. The left padding lines the title up with the greeting in
          the navbar card (its padding plus its 1px border). */}
      <div className="flex flex-wrap items-end justify-between gap-4 pl-[17px] sm:pl-[25px]">
        <div>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[30px]">
            Students
          </h1>
          <p className="mt-1.5 text-[15px] text-ink-secondary">
            Your students, organised by grade
            {hasGrades &&
              ` · ${pluralize(grades.length, 'grade')}, ${pluralize(studentTotal, 'student')}`}
          </p>
        </div>

        {/* Hidden in the empty state, which has its own button: one primary
            action per screen. */}
        {hasGrades && (
          <button
            type="button"
            onClick={() => setDialog({ type: 'create' })}
            className={primaryButtonClasses}
          >
            <PlusIcon className="h-[18px] w-[18px]" />
            Add grade
          </button>
        )}
      </div>

      {status === 'loading' && <GradesSkeleton />}

      {status === 'error' && (
        <div
          role="alert"
          className="
            flex flex-col items-center gap-3
            rounded-[14px] border border-border bg-surface
            px-6 py-10 text-center
          "
        >
          <p className="font-semibold text-ink">We couldn't load your grades</p>
          <p className="max-w-sm text-sm text-ink-secondary">{loadError}</p>
          <button
            type="button"
            onClick={reload}
            className="
              mt-1 h-11 rounded-[10px] border border-border bg-surface px-[18px]
              text-sm font-semibold text-ink
              cursor-pointer
              hover:bg-surface-hover
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary
            "
          >
            Try again
          </button>
        </div>
      )}

      {status === 'ready' && grades.length === 0 && (
        <GradesEmptyState onAddGrade={() => setDialog({ type: 'create' })} />
      )}

      {hasGrades && (
        <section
          aria-label="Grades"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {grades.map((grade) => (
            <GradeCard
              key={grade.id}
              grade={grade}
              onEdit={() => setDialog({ type: 'edit', grade })}
              onDelete={() => setDialog({ type: 'delete', grade })}
            />
          ))}
        </section>
      )}

      {/* Dialogs are mounted only while open, so each opening starts fresh. */}
      {dialog?.type === 'create' && (
        <GradeFormDialog
          onSubmit={addGrade}
          onClose={closeDialog}
        />
      )}

      {dialog?.type === 'edit' && (
        <GradeFormDialog
          grade={dialog.grade}
          onSubmit={(input) => editGrade(dialog.grade.id, input)}
          onClose={closeDialog}
        />
      )}

      {dialog?.type === 'delete' && (
        <DeleteGradeDialog
          grade={dialog.grade}
          onConfirm={() => removeGrade(dialog.grade.id)}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}

export default StudentsPage;
