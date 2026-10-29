// Recent activity at the database level: details come back exactly as
// logged, the feed's order and limit, ownership, the database's own rules,
// and the reason it's written by the backend: inside the action's
// transaction, it's saved with the action or not at all.
// Real database (diraya_test_db).

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { pool } from '../../config/db';
import { assertTestDatabase } from '../../test/assertTestDatabase';

import { findActivity, logActivity } from './activity.repository';

const teacherIds: string[] = [];

async function newTeacher(name: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO teachers (full_name, email) VALUES ($1, $2) RETURNING id::text AS id`,
    [name, `activity-repo-${name}-${Date.now()}@example.com`]
  );
  const id = result.rows[0]!.id;
  teacherIds.push(id);
  return id;
}

const PAYMENT = {
  studentId: '12',
  studentName: 'Adam Mostafa',
  amount: 350,
  months: ['2026-09', '2026-10'],
};

before(assertTestDatabase);

after(async () => {
  await pool.query('DELETE FROM teachers WHERE id = ANY ($1::bigint[])', [teacherIds]);
  await pool.end();
});

describe('logActivity + findActivity', () => {
  it('details come back exactly as logged: text, numbers and lists', async () => {
    const teacher = await newTeacher('Logger');

    await logActivity(pool, teacher, 'payment.recorded', PAYMENT);
    const [entry] = await findActivity(teacher, 10);

    assert.equal(entry?.type, 'payment.recorded');
    assert.deepEqual(entry?.details, PAYMENT);
    assert.ok(entry?.created_at instanceof Date);
  });

  it('newest first, cut to the limit, never another teacher’s', async () => {
    const teacher = await newTeacher('Busy');
    const other = await newTeacher('Elsewhere');
    for (const title of ['Quiz 1', 'Quiz 2', 'Quiz 3']) {
      await logActivity(pool, teacher, 'exam.added', {
        examId: '1',
        title,
        gradeName: 'Grade 1',
        heldOn: '2026-11-02',
      });
    }
    await logActivity(pool, other, 'payment.recorded', PAYMENT);

    const entries = await findActivity(teacher, 2);

    assert.deepEqual(
      entries.map((entry) => (entry.details as { title: string }).title),
      ['Quiz 3', 'Quiz 2']
    );
  });

  it('a new teacher has no activity: an empty list, not an error', async () => {
    assert.deepEqual(await findActivity(await newTeacher('Fresh'), 6), []);
  });
});

describe('written inside the action’s transaction', () => {
  it('the action fails (rollback): no activity is left behind', async () => {
    const teacher = await newTeacher('Rollback');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await logActivity(client, teacher, 'payment.recorded', PAYMENT);
      // The action's own write fails after the log line...
      await assert.rejects(client.query('SELECT 1 / 0'));
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    // ...so the feed never claims a payment that didn't happen.
    assert.deepEqual(await findActivity(teacher, 10), []);
  });

  it('the action succeeds (commit): the activity is there', async () => {
    const teacher = await newTeacher('Commit');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await logActivity(client, teacher, 'payment.recorded', PAYMENT);
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    assert.equal((await findActivity(teacher, 10)).length, 1);
  });
});

describe('the database’s own rules', () => {
  it('refuses a type that isn’t "area.event", and details that aren’t an object', async () => {
    const teacher = await newTeacher('Strict');
    const insert = (type: string, details: string) =>
      pool.query('INSERT INTO activity (teacher_id, type, details) VALUES ($1, $2, $3)', [
        teacher,
        type,
        details,
      ]);

    await assert.rejects(insert('Payment Recorded', '{}'), /activity_type_format/);
    await assert.rejects(insert('payment', '{}'), /activity_type_format/);
    await assert.rejects(insert('payment.recorded', '[1, 2]'), /activity_details_is_object/);
    await assert.rejects(insert('payment.recorded', '"text"'), /activity_details_is_object/);
  });

  it('deleting a teacher deletes their activity', async () => {
    const teacher = await newTeacher('Leaving');
    await logActivity(pool, teacher, 'payment.recorded', PAYMENT);

    await pool.query('DELETE FROM teachers WHERE id = $1', [teacher]);

    const left = await pool.query<{ n: number }>(
      'SELECT COUNT(*)::int AS n FROM activity WHERE teacher_id = $1',
      [teacher]
    );
    assert.equal(left.rows[0]?.n, 0);
  });
});

// Checked by the compiler (npx tsc), not at run time: each type only accepts
// its own details. If any of these stopped being an error, tsc would fail.
export async function typeChecks(teacher: string) {
  // @ts-expect-error a payment's details on 'student.added'
  await logActivity(pool, teacher, 'student.added', PAYMENT);
  // @ts-expect-error a missing field (months)
  await logActivity(pool, teacher, 'payment.recorded', { studentId: '1', studentName: 'A', amount: 1 });
  // @ts-expect-error a type that doesn't exist
  await logActivity(pool, teacher, 'payment.deleted', PAYMENT);
}
