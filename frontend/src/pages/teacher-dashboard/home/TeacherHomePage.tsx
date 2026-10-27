import Card from '../../../components/Card';
import { useHomeSummary, type HomeSummaryState } from '../../../hooks/home/useHomeSummary';
import EmptyState from '../../../components/EmptyState';
import { formatTime } from '../../../utils/formatSchedule';

import StudentsIcon from '../../../components/icons/StudentsIcon';
import CalendarIcon from '../../../components/icons/CalendarIcon';
import ExamsIcon from '../../../components/icons/ExamsIcon';
import PaymentsIcon from '../../../components/icons/PaymentsIcon';
import CheckCircleIcon from '../../../components/icons/CheckCircleIcon';
import ActivityIcon from '../../../components/icons/ActivityIcon';

import SummaryTile from './components/SummaryTile';
import GettingStartedCard from './components/GettingStartedCard';
import QuickActions from './components/QuickActions';
import TodayScheduleCard from './components/TodayScheduleCard';
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

/**
 * Teacher Home. The Students and Attendance tiles and Today's schedule read
 * GET /teacher/home; the rest still show their empty state until built.
 */
function TeacherHomePage() {
  const { state, reload } = useHomeSummary();
  const students = studentsTile(state);
  const attendance = attendanceTile(state);

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
          to="/teacher/exams"
          label="Papers to mark"
          value="0"
          hint="Nothing to mark"
          icon={<ExamsIcon className="h-[18px] w-[18px]" />}
        />
        <SummaryTile
          to="/teacher/payments"
          label="Payments overdue"
          value="EGP 0"
          hint="No overdue payments"
          icon={<PaymentsIcon className="h-[18px] w-[18px]" />}
        />
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-3">
        {/* Main column */}
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <GettingStartedCard />

          <TodayScheduleCard state={state} onRetry={reload} />

          <Card title="Needs your attention">
            <EmptyState
              tone="success"
              icon={<CheckCircleIcon className="h-6 w-6" />}
              title="You're all caught up"
              description="Overdue payments, repeated absences and unmarked papers will show up here."
            />
          </Card>
        </div>

        {/* Side column */}
        <div className="flex min-w-0 flex-col gap-6">
          <QuickActions />

          <Card title="Upcoming exams">
            <EmptyState
              icon={<ExamsIcon className="h-6 w-6" />}
              title="No exams scheduled"
              description="Create a quiz or exam and it will appear here."
              action={{ label: 'Create quiz', to: '/teacher/exams' }}
            />
          </Card>

          <Card title="Recent activity">
            <EmptyState
              icon={<ActivityIcon className="h-6 w-6" />}
              title="No activity yet"
              description="Your recent actions, such as recording a payment, will be listed here."
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

export default TeacherHomePage;
