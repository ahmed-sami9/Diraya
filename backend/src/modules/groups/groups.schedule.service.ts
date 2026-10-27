import { getGradeSummary, type GradeSummary } from '../grades/grades.service';

import { GroupErrors } from './groups.errors';
import { replaceGroupSchedule } from './groups.repository';
import { toSessions, type GroupSession, type GroupSummary } from './groups.service';
import type { ScheduleInput } from './groups.validation';

// Its own file, not groups.service: it needs grades.service, which already
// imports groups.service. Putting it there would make the two import each
// other (a circular dependency).

// Replaces a group's weekly timetable. Answers with the group AND its grade:
// the grade's "next class" is worked out from all its groups' timetables, so
// it changes too, and the page shows both without reloading.
export async function saveGroupSchedule(
  teacherId: string,
  groupId: string,
  input: ScheduleInput
): Promise<{ group: GroupSummary; grade: GradeSummary }> {
  const result = await replaceGroupSchedule(
    teacherId,
    groupId,
    input.sessions.map((session: GroupSession) => ({
      weekday: session.dayOfWeek,
      startTime: session.startTime,
    }))
  );

  if (result.status === 'not-found') throw GroupErrors.notFound();

  const grade = await getGradeSummary(teacherId, result.group.gradeId);

  return {
    group: { id: result.group.id, name: result.group.name, sessions: toSessions(result.slots) },
    grade,
  };
}
