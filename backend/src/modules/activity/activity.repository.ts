import type { Pool, PoolClient } from 'pg';

import { pool } from '../../config/db';

import type { ActivityDetails, ActivityType } from './activity.types';

// SQL for recent activity (table activity). Two jobs only: write one entry,
// read the latest ones. Every read filters by teacherId.

// The connection to write through. Pass the action's own transaction client,
// so the entry is saved with the action or not at all.
type Db = Pool | PoolClient;

// Records that something happened. Call it from a service, INSIDE the
// action's transaction, after the action's own writes:
//
//   await logActivity(client, teacherId, 'payment.recorded', {
//     studentId, studentName, amount, months,
//   });
//
// The generic ties `details` to `type`: TypeScript refuses a payment's
// details on 'student.added', or a missing field.
export async function logActivity<T extends ActivityType>(
  db: Db,
  teacherId: string,
  type: T,
  details: ActivityDetails[T]
): Promise<void> {
  await db.query('INSERT INTO activity (teacher_id, type, details) VALUES ($1, $2, $3)', [
    teacherId,
    type,
    JSON.stringify(details),
  ]);
}

export type ActivityRow = {
  id: string;
  type: ActivityType;
  // pg turns jsonb back into an object.
  details: ActivityDetails[ActivityType];
  created_at: Date;
};

// The teacher's latest activity, newest first. id breaks ties between
// entries saved in the same instant (two actions in one transaction).
export async function findActivity(teacherId: string, limit: number): Promise<ActivityRow[]> {
  const result = await pool.query<ActivityRow>(
    `
      SELECT id::text AS id, type, details, created_at
      FROM activity
      WHERE teacher_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2
    `,
    [teacherId, limit]
  );

  return result.rows;
}
