/**
 * Recent activity: one row per thing the teacher did ("recorded EGP 350 from
 * Adam", "took attendance for Sat & Tue · 4 PM").
 *
 * Written ONLY by the backend, inside the same transaction as the action it
 * describes (see activity.repository.ts, logActivity): the action and its
 * row are saved together or not at all, and the browser can never write one.
 *
 *   type      what happened, "area.event": 'payment.recorded', 'student.added'
 *   details   the facts, as JSON, shaped per type (activity.types.ts). Facts,
 *             never sentences: the frontend words them, so the wording can
 *             change (or be translated) without touching old rows. Names are
 *             kept as they were at the time, so history still reads right
 *             after a rename or a delete.
 *
 * Rules the DATABASE enforces:
 *   - type looks like "area.event" (lowercase, one dot)
 *   - details is a JSON object
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.createTable('activity', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },

    // Ownership in one WHERE, and deleting a (demo) teacher removes their history.
    teacher_id: {
      type: 'bigint',
      notNull: true,
      references: 'teachers',
      onDelete: 'CASCADE',
    },

    type: {
      type: 'varchar(50)',
      notNull: true,
    },

    details: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },

    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Not a fixed list on purpose: a new kind of activity needs no migration.
  // The list of types lives in code (activity.types.ts), checked by TypeScript.
  pgm.addConstraint('activity', 'activity_type_format', {
    check: "type ~ '^[a-z]+(-[a-z]+)*\\.[a-z]+(-[a-z]+)*$'",
  });

  pgm.addConstraint('activity', 'activity_details_is_object', {
    check: "jsonb_typeof(details) = 'object'",
  });

  // "This teacher's latest activity": the feed's one query.
  pgm.createIndex('activity', [
    'teacher_id',
    { name: 'created_at', sort: 'DESC' },
    { name: 'id', sort: 'DESC' },
  ]);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropTable('activity');
};
