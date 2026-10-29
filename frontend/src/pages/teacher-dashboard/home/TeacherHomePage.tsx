import { useHomeSummary, type HomeSummaryState } from '../../../hooks/home/useHomeSummary';
import { useExams } from '../../../hooks/exams/useExams';
import { usePaymentsOverview } from '../../../hooks/payments/usePayments';
import { formatTime } from '../../../utils/formatSchedule';
import { pluralize } from '../../../utils/formatSession';
import { todayInCairo } from '../../../utils/cairoDate';
import { examPath, examsMissingMarks, papersToMark } from '../exams/examHelpers';
import { currentMonth, earlierOwedLink, formatMoney } from '../payment/paymentsHelpers';

import StudentsIcon from '../../../components/icons/StudentsIcon';
import CalendarIcon from '../../../components/icons/CalendarIcon';
import ExamsIcon from '../../../components/icons/ExamsIcon';
import PaymentsIcon from '../../../components/icons/PaymentsIcon';

import SummaryTile from './components/SummaryTile';
import GettingStartedCard from './components/GettingStartedCard';
import QuickActions from './components/QuickActions';
import TodayScheduleCard from './components/TodayScheduleCard';
import UpcomingExamsCard from './components/UpcomingExamsCard';
import NotesCard from './components/NotesCard';
import RecentActivityCard from './components/RecentActivityCard';
import { attendanceLink, todayProgress } from './todayClasses';

const formatCount = (value: number) => value.toLocaleString('en-GB');

// The Students tile's number and the line under it.
function studentsTile(state: HomeSummaryState): { value: string; hint: string } {
  if (state.status === 'loading') return { value: '–', hint: 'Loading…' };
  if (state.status === 'error') return { value: '–', hint: 'Couldn’t load right now' };

  const { total, joinedThisMonth } = state.summary.students;

  if (total === 0) return { value: '0', hint: 'Add your first student' };

  return {
    value: formatCount(total),
    hint:
      joinedThisMonth > 0
        ? `+${formatCount(joinedThisMonth)} joined this month`
        : 'No new students this month',
  };
}

// The Attendance tile: how many of today's classes are taken, and a link
// straight to the next one still waiting.
function attendanceTile(state: HomeSummaryState): { value: string; hint: string; to: string } {
  const fallback = '/teacher/attendance';

  if (state.status === 'loading') return { value: '–', hint: 'Loading…', to: fallback };
  if (state.status === 'error') return { value: '–', hint: 'Couldn’t load right now', to: fallback };

  const { date, classes } = state.summary.classesToday;
  const { total, taken, next } = todayProgress(classes);

  if (total === 0) return { value: '0', hint: 'No classes today', to: fallback };
  if (!next) return { value: `${taken}/${total}`, hint: 'All taken ✓', to: fallback };

  return {
    value: `${taken}/${total}`,
    hint: `Next: ${formatTime(next.startTime)} · ${next.groupName}`,
    to: attendanceLink(next.groupId, date),
  };
}

// The Papers to mark tile: the same rule as the Exams page's "Marks still
// missing" banner. One exam waiting -> open it; several -> the Exams page.
function marksTile(state: ReturnType<typeof useExams>['state']): {
  value: string;
  hint: string;
  to: string;
} {
  const fallback = '/teacher/exams';

  if (state.status === 'loading') return { value: '–', hint: 'Loading…', to: fallback };
  if (state.status === 'error') return { value: '–', hint: 'Couldn’t load right now', to: fallback };

  const missing = examsMissingMarks(state.exams, todayInCairo());
  const [newest] = missing;

  if (!newest) return { value: '0', hint: 'Nothing to mark', to: fallback };

  const value = formatCount(papersToMark(missing));

  if (missing.length === 1) {
    return { value, hint: `${newest.title} · ${newest.grade.name}`, to: examPath(newest.id) };
  }

  return { value, hint: `${newest.title} + ${missing.length - 1} more`, to: fallback };
}

// The Payments overdue tile: money still owed from months BEFORE this one,
// worked out by the server (the Payments page's "Owed from earlier months").
// This month isn't overdue yet: it's still running.
function overdueTile(state: ReturnType<typeof usePaymentsOverview>['state']): {
  value: string;
  hint: string;
  to: string;
} {
  const fallback = '/teacher/payments';

  if (state.status === 'loading') return { value: '–', hint: 'Loading…', to: fallback };
  if (state.status === 'error') return { value: '–', hint: 'Couldn’t load right now', to: fallback };

  const earlier = state.overview.earlierOwed;

  if (!earlier) return { value: formatMoney(0), hint: 'No overdue payments', to: fallback };

  return {
    value: formatMoney(earlier.amount),
    hint: `${pluralize(earlier.students, 'student')} from earlier months`,
    to: earlierOwedLink(earlier),
  };
}

/**
 * Teacher Home. Students, Attendance and Today's schedule read GET
 * /teacher/home; Papers to mark and Upcoming exams read the exams list, and
 * Payments overdue the payments overview: the same requests their own pages
 * make. My notes and Recent activity load their own data (their cards).
 */
function TeacherHomePage() {
  const { state, reload } = useHomeSummary();
  const students = studentsTile(state);
  const attendance = attendanceTile(state);
  // The exams list, the same one the Exams page reads (see marksTile).
  const exams = useExams();
  const marks = marksTile(exams.state);
  // This month's overview, the same one the Payments page opens on.
  const payments = usePaymentsOverview(currentMonth());
  const overdue = overdueTile(payments.state);

  return (
    <div className="flex flex-col gap-6">
      {/* The visible greeting lives in the navbar; this names the page for screen readers. */}
      <h1 className="sr-only">Home</h1>

      <section
        aria-label="Summary"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryTile
          to="/teacher/students"
          label="Students"
          value={students.value}
          hint={students.hint}
          icon={<StudentsIcon className="h-[18px] w-[18px]" />}
        />
        <SummaryTile
          to={attendance.to}
          label="Attendance today"
          value={attendance.value}
          hint={attendance.hint}
          icon={<CalendarIcon className="h-[18px] w-[18px]" />}
        />
        <SummaryTile
          to={marks.to}
          label="Papers to mark"
          value={marks.value}
          hint={marks.hint}
          icon={<ExamsIcon className="h-[18px] w-[18px]" />}
        />
        <SummaryTile
          to={overdue.to}
          label="Payments overdue"
          value={overdue.value}
          hint={overdue.hint}
          icon={<PaymentsIcon className="h-[18px] w-[18px]" />}
        />
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-3">
        {/* Main column */}
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <GettingStartedCard />

          <TodayScheduleCard state={state} onRetry={reload} />

          <NotesCard />
        </div>

        {/* Side column */}
        <div className="flex min-w-0 flex-col gap-6">
          <QuickActions />

          <UpcomingExamsCard state={exams.state} today={todayInCairo()} onRetry={exams.reload} />

          <RecentActivityCard />
        </div>
      </div>
    </div>
  );
}

export default TeacherHomePage;
