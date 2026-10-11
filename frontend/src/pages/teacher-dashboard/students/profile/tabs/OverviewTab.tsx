import { Link, useOutletContext } from 'react-router-dom';

import PlusIcon from '../../../../../components/icons/PlusIcon';
import { primaryButtonClasses } from '../../../../../components/formStyles';
import { pluralize } from '../../../../../utils/formatSession';

import AttendanceStrip, { AttendanceLegend } from '../components/AttendanceStrip';
import EmptyHint from '../components/EmptyHint';
import ExamList from '../components/ExamList';
import NotesPanel from '../components/NotesPanel';
import PaymentList from '../components/PaymentList';
import SectionCard from '../components/SectionCard';
import { formatLongDate, formatMoney } from '../profileFormat';
import type { ProfileOutletContext } from '../profileTypes';

// How much of each list the overview shows. The tabs show everything.
const RECENT_SESSIONS = 12;
const RECENT_EXAMS = 5;
const RECENT_MONTHS = 3;
const RECENT_NOTES = 2;

const seeAllClasses =
  'rounded text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

// /teacher/students/:studentId — the most recent of everything, with a
// "See all" into each tab.
function OverviewTab() {
  const { data, actions } = useOutletContext<ProfileOutletContext>();
  const { profile, attendance, exams, payments, notes } = data;

  const recentSessions = attendance.slice(0, RECENT_SESSIONS);
  const recentAbsences = recentSessions.filter((record) => record.status === 'absent');
  const average = profile.summary.marks.average;

  return (
    // Two columns on wide screens; the side column drops under on smaller ones.
    <div className="flex flex-wrap items-start gap-5">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
        <SectionCard
          title="Attendance"
          subtitle={
            recentSessions.length > 0
              ? `last ${pluralize(recentSessions.length, 'session')}`
              : undefined
          }
          action={
            attendance.length > 0 && (
              <Link
                to="attendance"
                className={seeAllClasses}
              >
                Full history
              </Link>
            )
          }
        >
          {recentSessions.length === 0 ? (
            <EmptyHint>
              Sessions appear here once you take attendance for this student’s group.
            </EmptyHint>
          ) : (
            <>
              <AttendanceStrip records={recentSessions} />
              <AttendanceLegend />
              {recentAbsences.length > 0 && (
                <p className="rounded-[10px] bg-danger-tint px-3.5 py-2.5 text-sm text-ink-secondary">
                  <strong className="text-danger">
                    {pluralize(recentAbsences.length, 'absence')}
                  </strong>
                  {' · '}
                  {recentAbsences.map((record) => formatLongDate(record.heldAt)).join(', ')}
                </p>
              )}
            </>
          )}
        </SectionCard>

        <SectionCard
          title="Exams & marks"
          subtitle={average !== null ? `average ${average}%` : undefined}
          action={
            exams.length > 0 && (
              <Link
                to="marks"
                className={seeAllClasses}
              >
                All exams
              </Link>
            )
          }
        >
          {exams.length === 0 ? (
            <EmptyHint>
              Marks appear here once you record this student’s first exam or quiz.
            </EmptyHint>
          ) : (
            <ExamList exams={exams.slice(0, RECENT_EXAMS)} />
          )}
        </SectionCard>
      </div>

      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
        <SectionCard
          title="Payments"
          subtitle={
            profile.monthlyFee !== null ? `${formatMoney(profile.monthlyFee)} / month` : undefined
          }
          action={
            payments.length > RECENT_MONTHS && (
              <Link
                to="payments"
                className={seeAllClasses}
              >
                All months
              </Link>
            )
          }
        >
          {payments.length === 0 ? (
            <EmptyHint>No payments recorded yet.</EmptyHint>
          ) : (
            <PaymentList payments={payments.slice(0, RECENT_MONTHS)} />
          )}
          <button
            type="button"
            onClick={actions.recordPayment}
            className={`${primaryButtonClasses} flex items-center justify-center gap-2`}
          >
            <PlusIcon className="h-[18px] w-[18px]" />
            Record payment
          </button>
        </SectionCard>

        <SectionCard
          title="Your notes"
          action={
            notes.length > RECENT_NOTES && (
              <Link
                to="notes"
                className={seeAllClasses}
              >
                All notes
              </Link>
            )
          }
        >
          <NotesPanel
            notes={notes.slice(0, RECENT_NOTES)}
            onAddNote={actions.addNote}
          />
        </SectionCard>
      </div>
    </div>
  );
}

export default OverviewTab;
