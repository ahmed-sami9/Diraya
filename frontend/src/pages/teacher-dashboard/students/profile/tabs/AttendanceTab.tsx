import { useOutletContext } from 'react-router-dom';

import AttendanceStrip, { AttendanceLegend } from '../components/AttendanceStrip';
import EmptyHint from '../components/EmptyHint';
import SectionCard from '../components/SectionCard';
import { formatMonth, groupAttendanceByMonth } from '../profileFormat';
import type { ProfileOutletContext } from '../profileTypes';

// /teacher/students/:studentId/attendance — every session, one block per
// month, newest month first, each with its own "attended X of Y".
function AttendanceTab() {
  const { data } = useOutletContext<ProfileOutletContext>();
  const months = groupAttendanceByMonth(data.attendance);

  if (months.length === 0) {
    return (
      <SectionCard title="Attendance history">
        <EmptyHint>
          Nothing yet. Each time you take attendance for this student’s group, the session appears
          here.
        </EmptyHint>
      </SectionCard>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <AttendanceLegend />

      {months.map((month) => (
        <SectionCard
          key={month.month}
          title={formatMonth(month.month)}
          subtitle={`attended ${month.attended} of ${month.records.length}`}
        >
          <AttendanceStrip records={month.records} />
        </SectionCard>
      ))}
    </div>
  );
}

export default AttendanceTab;
