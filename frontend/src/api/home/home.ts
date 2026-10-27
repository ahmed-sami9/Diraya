import { apiRequest } from '../apiClient';

// One class from the groups' timetables, on today's date in Egypt.
export type TodayClass = {
  groupId: string;
  groupName: string;
  gradeId: string;
  gradeName: string;
  // "16:00", Egypt time.
  startTime: string;
  // Attendance has already been taken for it today.
  taken: boolean;
};

// Everything the Home page shows, from GET /teacher/home. More tiles add
// more keys (backend: modules/home/home.service.ts).
export type HomeSummary = {
  students: {
    total: number;
    // Joined during this calendar month, in Egypt.
    joinedThisMonth: number;
  };
  classesToday: {
    // Egypt's date, "YYYY-MM-DD": the date attendance is taken for.
    date: string;
    // Earliest first.
    classes: TodayClass[];
  };
};

export async function getHomeSummary(signal?: AbortSignal): Promise<HomeSummary> {
  const { summary } = await apiRequest<{ summary: HomeSummary }>('GET', '/teacher/home', {
    signal,
  });

  return summary;
}
