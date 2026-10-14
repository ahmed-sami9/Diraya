// The attendance rules every part of the app shares: the sheet, the
// student's profile, the grade table. One place, so "attendance rate" means
// the same thing on every screen.

export const ATTENDANCE_STATUSES = ['present', 'late', 'absent', 'excused'] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

// The rate as a whole percent, or null when there is nothing to count yet
// ("no sessions" is not "0%").
//
// attended = present + late (a late student still came)
// total    = every session except excused ones: an excused absence (a sick
//            note) neither helps nor hurts the rate.
//
// The counting itself happens in SQL (COUNT ... FILTER); this only turns the
// two counts into the number shown.
export function toAttendanceRate(attended: number, total: number): number | null {
  return total === 0 ? null : Math.round((attended / total) * 100);
}

// Only these statuses can carry a reason ("sick", "travelling"...).
export const statusTakesReason = (status: AttendanceStatus) =>
  status === 'absent' || status === 'excused';
