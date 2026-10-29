import { findActivity } from './activity.repository';
import type { ActivityEntry } from './activity.types';

// Shapes rows for the API: camelCase, createdAt as an ISO string. The
// details go out exactly as they were logged; the frontend words them.
export async function listActivity(teacherId: string, limit: number): Promise<ActivityEntry[]> {
  const rows = await findActivity(teacherId, limit);

  return rows.map(
    (row) =>
      ({
        id: row.id,
        type: row.type,
        details: row.details,
        createdAt: row.created_at.toISOString(),
      }) as ActivityEntry
  );
}
