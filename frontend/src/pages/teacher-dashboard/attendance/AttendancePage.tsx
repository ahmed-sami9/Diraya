import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import type { IsoDay } from '../../../api/attendance/attendance';
import type { AttendanceStatus } from '../../../api/students/profile';
import SectionError from '../../../components/SectionError';
import { useAttendanceOptions } from '../../../hooks/attendance/useAttendanceOptions';
import { useAttendanceSheet } from '../../../hooks/attendance/useAttendanceSheet';
import { useDelayedFlag } from '../../../hooks/useDelayedFlag';
import { formatIsoDay, isValidIsoDay, todayInCairo } from '../../../utils/cairoDate';

import AddMakeUpStudent from './components/AddMakeUpStudent';
import DiscardChangesDialog from './components/DiscardChangesDialog';
import SheetControls from './components/SheetControls';
import SheetFooter from './components/SheetFooter';
import StudentMarkRow from './components/StudentMarkRow';

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit' });

// /teacher/attendance?groupId=6&date=2026-10-12
//
// One screen: pick the class at the top, mark students below, Save at the
// bottom. Which class is in the URL, so a refresh, the Back button or a
// shared link opens the same sheet. With no groupId, the server picks the
// default group and the URL is filled in once it's known.
function AttendancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const today = todayInCairo();

  const groupId = searchParams.get('groupId');
  const dateParam = searchParams.get('date');
  // A missing, malformed or future date falls back to today.
  const date: IsoDay =
    dateParam && isValidIsoDay(dateParam) && dateParam <= today ? dateParam : today;

  const options = useAttendanceOptions();
  const sheet = useAttendanceSheet(groupId, date);

  // Where the teacher asked to go while having unsaved marks.
  const [pending, setPending] = useState<{ groupId: string; date: IsoDay } | null>(null);

  const goTo = (next: { groupId: string; date: IsoDay }) => {
    // replace: switching sheets shouldn't fill the Back button's history.
    setSearchParams({ groupId: next.groupId, date: next.date }, { replace: true });
  };

  const requestSwitch = (next: { groupId: string; date: IsoDay }) => {
    if (next.groupId === groupId && next.date === date) return;

    if (sheet.isDirty) setPending(next);
    else goTo(next);
  };

  // The server chose the default group: put it in the URL, so a refresh
  // stays on it. (The hook knows not to load the same sheet twice.)
  const loadedSheet = sheet.state.status === 'ready' ? sheet.state.sheet : null;
  useEffect(() => {
    if (loadedSheet && !groupId) {
      setSearchParams({ groupId: loadedSheet.group.id, date }, { replace: true });
    }
  }, [loadedSheet, groupId, date, setSearchParams]);

  // Closing the tab or reloading with unsaved marks: the browser asks first.
  useEffect(() => {
    if (!sheet.isDirty) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);

    return () => window.removeEventListener('beforeunload', warn);
  }, [sheet.isDirty]);

  // Totals for the footer, counted from the marks on screen.
  const counts = useMemo(() => {
    const totals: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, excused: 0 };

    for (const student of sheet.students) {
      const status = sheet.marks[student.id]?.status;
      if (status) totals[status] += 1;
    }

    return totals;
  }, [sheet.students, sheet.marks]);

  const onSheetIds = useMemo(
    () => new Set(sheet.students.map((student) => student.id)),
    [sheet.students]
  );

  /* --------------------------------- States -------------------------------- */

  if (options.state.status === 'error') {
    return (
      <PageFrame>
        <SectionError
          title="We couldn’t open attendance"
          error={options.state.error}
          onRetry={options.reload}
        />
      </PageFrame>
    );
  }

  if (sheet.state.status === 'no-groups') {
    return (
      <PageFrame>
        <section className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-6 py-12 text-center">
          <h2 className="text-lg font-bold text-ink">No classes to take attendance for yet</h2>
          <p className="max-w-sm text-sm text-ink-secondary">
            Add a grade and its students first. Each grade starts with a group, ready for
            attendance.
          </p>
          <Link
            to="/teacher/students"
            className="mt-3 flex h-11 items-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Go to Students
          </Link>
        </section>
      </PageFrame>
    );
  }

  if (sheet.state.status === 'group-not-found') {
    return (
      <PageFrame>
        <section className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-6 py-12 text-center">
          <h2 className="text-lg font-bold text-ink">This group doesn’t exist any more</h2>
          <p className="max-w-sm text-sm text-ink-secondary">
            It may have been deleted, or the link is old. Pick a class to continue.
          </p>
          {/* No groupId: the server picks the default group again. */}
          <Link
            to={`/teacher/attendance?date=${date}`}
            replace
            className="mt-3 flex h-11 items-center rounded-[10px] border border-border px-4 text-sm font-semibold text-ink hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Open attendance
          </Link>
        </section>
      </PageFrame>
    );
  }

  if (sheet.state.status === 'error') {
    return (
      <PageFrame>
        <SectionError
          title="We couldn’t load this sheet"
          error={sheet.state.error}
          onRetry={sheet.reload}
        />
      </PageFrame>
    );
  }

  if (sheet.state.status === 'loading' || options.state.status === 'loading') {
    return (
      <PageFrame>
        <SheetSkeleton />
      </PageFrame>
    );
  }

  /* --------------------------------- Ready --------------------------------- */

  const { grade, group, session } = sheet.state.sheet;
  const grades = options.state.grades;
  const gradeGroups = grades.find((item) => item.id === grade.id)?.groups ?? [];
  const isPastDay = date !== today;

  return (
    <PageFrame>
      <section
        aria-label="Which class"
        className="rounded-2xl border border-border bg-surface p-4 sm:p-5"
      >
        <SheetControls
          grades={grades}
          gradeId={grade.id}
          groupId={group.id}
          date={date}
          maxDate={today}
          disabled={sheet.isSaving}
          onChange={requestSwitch}
        />
      </section>

      <section
        aria-label={`Attendance for ${group.name}`}
        className="rounded-2xl border border-border bg-surface"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-strong px-4 py-3 sm:px-5">
          <div className="flex min-w-0 flex-col">
            <h2 className="truncate text-[17px] font-bold text-ink">
              {grade.name} · {group.name}
            </h2>
            <p className="text-[13px] text-ink-secondary">
              {formatIsoDay(date)}
              {isPastDay && ' · a past day'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Whether this class is already recorded, and when. */}
            {session ? (
              <span className="rounded-full bg-success-tint px-3 py-1 text-xs font-bold text-success">
                Saved {timeFormat.format(new Date(session.createdAt))}
                {session.editedAt && ' · edited later'}
              </span>
            ) : (
              <span className="rounded-full bg-warning-tint px-3 py-1 text-xs font-bold text-warning">
                Not taken yet
              </span>
            )}

            {sheet.students.length > 0 && (
              <button
                type="button"
                onClick={() => sheet.markAll('present')}
                disabled={sheet.isSaving}
                className="h-9 rounded-[10px] px-3 text-[13px] font-semibold text-primary hover:bg-primary-tint disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Mark all present
              </button>
            )}
          </div>
        </div>

        {sheet.students.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <h3 className="text-base font-bold text-ink">No students in {group.name}</h3>
            <p className="max-w-sm text-sm text-ink-secondary">
              Add students to this group first, or pick another group above.
            </p>
            <Link
              to={`/teacher/students/grades/${grade.id}?group=${group.id}`}
              className="mt-2 text-sm font-semibold text-primary hover:underline"
            >
              Open {grade.name}
            </Link>
          </div>
        ) : (
          <ul aria-label="Students">
            {sheet.students.map((student) => {
              const mark = sheet.marks[student.id];
              if (!mark) return null;

              return (
                <StudentMarkRow
                  key={student.id}
                  student={student}
                  mark={mark}
                  isRemovable={sheet.addedIds.includes(student.id)}
                  disabled={sheet.isSaving}
                  onSetStatus={(status) => sheet.setStatus(student.id, status)}
                  onSetReason={(reason) => sheet.setReason(student.id, reason)}
                  onRemove={() => sheet.removeMakeUp(student.id)}
                />
              );
            })}
          </ul>
        )}

        <div className="border-t border-border-strong px-4 py-2 sm:px-5">
          <AddMakeUpStudent
            gradeId={grade.id}
            groupId={group.id}
            groups={gradeGroups}
            onSheetIds={onSheetIds}
            disabled={sheet.isSaving}
            onAdd={sheet.addMakeUp}
          />
        </div>

        <SheetFooter
          counts={counts}
          canSave={sheet.canSave}
          isSaving={sheet.isSaving}
          isDirty={sheet.isDirty}
          isSaved={session !== null}
          saveError={sheet.saveError}
          onSave={sheet.save}
        />
      </section>

      {pending && (
        <DiscardChangesDialog
          onKeep={() => setPending(null)}
          onDiscard={() => {
            goTo(pending);
            setPending(null);
          }}
        />
      )}
    </PageFrame>
  );
}

function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Take attendance</h1>
        <p className="text-sm text-ink-secondary">
          Everyone starts as present. Tap the few who aren’t, then save.
        </p>
      </header>
      {children}
    </div>
  );
}

// Only after a short delay, so a fast answer never flashes it.
function SheetSkeleton() {
  const isVisible = useDelayedFlag(true);

  if (!isVisible) return null;

  return (
    <div
      role="status"
      className="flex animate-pulse flex-col gap-5"
    >
      <span className="sr-only">Loading attendance</span>
      <div className="h-[92px] rounded-2xl border border-border bg-surface" />
      <div className="h-[420px] rounded-2xl border border-border bg-surface" />
    </div>
  );
}

export default AttendancePage;
