import { Suspense, useEffect, useState } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';

import ChevronRightIcon from '../../../../components/icons/ChevronRightIcon';
import SectionError from '../../../../components/SectionError';
import { useAuth } from '../../../../context/AuthContext';
import { useDelayedFlag } from '../../../../hooks/useDelayedFlag';
import { useStudentProfile } from '../../../../hooks/students/useStudentProfile';
import { todayInCairo } from '../../../../utils/cairoDate';

import ProfileHeader from './components/ProfileHeader';
import ProfileTabs from './components/ProfileTabs';
import SummaryTiles from './components/SummaryTiles';
import { downloadStudentReport } from './report/downloadReport';
import { buildStudentReport } from './report/reportData';
import ShareWithParentDialog from './share/ShareWithParentDialog';
import type { ProfileActions, ProfileOutletContext } from './profileTypes';

// The route: /teacher/students/:studentId and its tabs.
//
// Like GradePage, a `key` per student gives each one a fresh page: opening
// another student from the navbar search can't carry over a half-typed note.
function StudentProfileLayout() {
  const { studentId = '' } = useParams();

  return (
    <StudentProfileContent
      key={studentId}
      studentId={studentId}
    />
  );
}

function StudentProfileContent({ studentId }: { studentId: string }) {
  const { state, reload, addNote } = useStudentProfile(studentId);
  const { user } = useAuth();
  const [isSharing, setIsSharing] = useState(false);
  const [reportStatus, setReportStatus] = useState<'idle' | 'working' | 'failed'>('idle');

  // A failure message clears itself; the saved file is its own success message.
  useEffect(() => {
    if (reportStatus !== 'failed') return;
    const timer = setTimeout(() => setReportStatus('idle'), 6000);
    return () => clearTimeout(timer);
  }, [reportStatus]);

  const downloadReport = async () => {
    if (state.status !== 'ready' || !user || reportStatus === 'working') return;

    setReportStatus('working');
    try {
      // Named fields, not the whole page data: notes must never reach the PDF.
      const { profile, attendance, exams, payments } = state.data;
      const report = buildStudentReport(
        { profile, attendance, exams, payments },
        { teacherName: user.name, currentMonth: todayInCairo().slice(0, 7) }
      );
      await downloadStudentReport(report);
      setReportStatus('idle');
    } catch (error) {
      console.error(error);
      setReportStatus('failed');
    }
  };

  // What each button does. Notes and Retry go to the server (through the
  // hook), Share opens its dialog; the rest open dialogs that aren't built yet.
  const actions: ProfileActions = {
    addNote,
    retry: reload,
    // TODO(dialog): Edit student (PATCH /teacher/students/:studentId)
    editStudent: () => console.info('TODO: open the Edit student dialog'),
    shareWithParent: () => setIsSharing(true),
    downloadReport,
    // TODO(dialog): Move to group (PATCH /teacher/students/:studentId { groupId })
    moveToGroup: () => console.info('TODO: open the Move to group dialog'),
    // TODO(dialog): Record payment (POST /teacher/students/:studentId/payments)
    recordPayment: () => console.info('TODO: open the Record payment dialog'),
  };

  const linkClasses =
    'rounded font-semibold text-ink-secondary hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5">
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 flex-wrap items-center gap-2 pl-1 text-sm"
      >
        <Link
          to="/teacher/students"
          className={`flex items-center gap-1 ${linkClasses}`}
        >
          <ChevronRightIcon className="h-4 w-4 rotate-180" />
          Students
        </Link>
        {state.status === 'ready' && (
          <>
            <span
              aria-hidden="true"
              className="text-ink-muted"
            >
              /
            </span>
            <Link
              to={`/teacher/students/grades/${state.data.profile.grade.id}`}
              className={linkClasses}
            >
              {state.data.profile.grade.name}
            </Link>
            <span
              aria-hidden="true"
              className="text-ink-muted"
            >
              /
            </span>
            <span
              aria-current="page"
              className="truncate font-semibold text-ink"
            >
              {state.data.profile.name}
            </span>
          </>
        )}
      </nav>

      {state.status === 'loading' && <ProfileSkeleton />}

      {state.status === 'error' && (
        <SectionError
          title="We couldn’t load this student"
          error={state.error}
          onRetry={actions.retry}
        />
      )}

      {state.status === 'not-found' && (
        <section className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-6 py-12 text-center">
          <h1 className="text-lg font-bold text-ink">This student doesn’t exist</h1>
          <p className="max-w-sm text-sm text-ink-secondary">
            They may have been removed, or the link is wrong.
          </p>
          <Link
            to="/teacher/students"
            className="mt-3 flex h-11 items-center rounded-[10px] border border-border px-4 text-sm font-semibold text-ink hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Back to your students
          </Link>
        </section>
      )}

      {state.status === 'ready' && (
        <>
          <ProfileHeader
            profile={state.data.profile}
            actions={actions}
          />
          <SummaryTiles summary={state.data.profile.summary} />
          <ProfileTabs />

          {/* The active tab. It reads the data and actions from here
              (useOutletContext), so the profile is loaded once for all tabs.
              Tabs load lazily: a short local fallback, not the whole page. */}
          <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-surface" />}>
            <Outlet context={{ data: state.data, actions } satisfies ProfileOutletContext} />
          </Suspense>

          {/* Always signed in here (a protected route); the check is for TypeScript. */}
          {isSharing && user && (
            <ShareWithParentDialog
              profile={state.data.profile}
              teacherName={user.name}
              onClose={() => setIsSharing(false)}
              onDownloadReport={downloadReport}
            />
          )}

          {/* Always mounted, so screen readers announce what appears in it. */}
          <p
            role="status"
            className={
              reportStatus === 'idle'
                ? 'sr-only'
                : 'fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-page shadow-lg'
            }
          >
            {reportStatus === 'working' && 'Preparing the PDF report…'}
            {reportStatus === 'failed' && 'Couldn’t create the PDF report. Please try again.'}
          </p>
        </>
      )}
    </div>
  );
}

// Only after a short delay, so a fast answer never flashes it.
function ProfileSkeleton() {
  const isVisible = useDelayedFlag(true);

  if (!isVisible) return null;

  return (
    <div
      role="status"
      className="flex animate-pulse flex-col gap-5"
    >
      <span className="sr-only">Loading student</span>
      <div className="h-[200px] rounded-2xl border border-border bg-surface" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="h-28 rounded-[14px] bg-surface" />
        <div className="h-28 rounded-[14px] bg-surface" />
        <div className="h-28 rounded-[14px] bg-surface" />
        <div className="h-28 rounded-[14px] bg-surface" />
      </div>
      <div className="h-[360px] rounded-2xl border border-border bg-surface" />
    </div>
  );
}

export default StudentProfileLayout;
