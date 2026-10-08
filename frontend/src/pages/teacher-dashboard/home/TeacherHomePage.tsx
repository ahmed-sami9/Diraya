import Card from '../../../components/Card';
import EmptyState from '../../../components/EmptyState';

import StudentsIcon from '../../../components/icons/StudentsIcon';
import CalendarIcon from '../../../components/icons/CalendarIcon';
import ExamsIcon from '../../../components/icons/ExamsIcon';
import PaymentsIcon from '../../../components/icons/PaymentsIcon';
import CheckCircleIcon from '../../../components/icons/CheckCircleIcon';
import ActivityIcon from '../../../components/icons/ActivityIcon';

import SummaryTile from './components/SummaryTile';
import GettingStartedCard from './components/GettingStartedCard';
import QuickActions from './components/QuickActions';

/**
 * Teacher Home, empty state: what a teacher sees before any students,
 * classes, exams or payments exist. The filled state arrives with the API.
 */
function TeacherHomePage() {
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
          value="0"
          hint="Add your first student"
          icon={<StudentsIcon className="h-[18px] w-[18px]" />}
        />
        <SummaryTile
          to="/teacher/students"
          label="Attendance today"
          value="–"
          hint="No classes today"
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

          <Card title="Today's schedule">
            <EmptyState
              icon={<CalendarIcon className="h-6 w-6" />}
              title="No classes today"
              description="Classes you schedule will appear here on the day they run."
            />
          </Card>

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
