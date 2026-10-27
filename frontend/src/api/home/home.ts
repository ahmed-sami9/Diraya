import { apiRequest } from '../apiClient';

// Everything the Home page shows, from GET /teacher/home. More tiles add
// more keys (backend: modules/home/home.service.ts).
export type HomeSummary = {
  students: {
    total: number;
    // Joined during this calendar month, in Egypt.
    joinedThisMonth: number;
  };
};

export async function getHomeSummary(signal?: AbortSignal): Promise<HomeSummary> {
  const { summary } = await apiRequest<{ summary: HomeSummary }>('GET', '/teacher/home', {
    signal,
  });

  return summary;
}
