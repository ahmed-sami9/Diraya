/**
 * When each group meets: its weekly timetable, as a template.
 *
 *   group_schedules   one row per group per weekday: "Group A meets every
 *                     Saturday at 16:00". The PLAN, stored once.
 *   class_sessions    one row per class that actually happened (attendance).
 *                     The FACT, stored when it happens.
 *
 * "What's on today" is worked out, never stored: today's weekday in Egypt ->
 * the slots for that weekday. Joined with class_sessions, it also says which
 * of today's classes already had attendance taken.
 *
 * The plan never blocks reality: attendance can still be taken on a day that
 * isn't scheduled (an extra class), and changing the timetable doesn't change
 * history (each class_session keeps its own date and start time).
 *
 * Rules the DATABASE enforces:
 *   - weekday is 0 (Sunday) to 6 (Saturday), like JavaScript's getDay()
 *   - one slot per group per weekday
 *   - times are whole minutes ("16:00", never "16:00:37")
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.createTable('group_schedules', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },

    // For ownership checks in one WHERE, and so deleting a (demo) teacher
    // removes their timetable.
    teacher_id: {
      type: 'bigint',
      notNull: true,
      references: 'teachers',
      onDelete: 'CASCADE',
    },

    // A timetable means nothing without its group: it goes with it.
    group_id: {
      type: 'bigint',
      notNull: true,
      references: 'groups',
      onDelete: 'CASCADE',
    },

    weekday: {
      type: 'smallint',
      notNull: true,
    },

    // Egypt's wall-clock time, not a moment: "16:00" means 4 PM in Egypt
    // every week, whatever daylight saving does.
    start_time: {
      type: 'time',
      notNull: true,
    },

    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  pgm.addConstraint('group_schedules', 'group_schedules_weekday_check', {
    check: 'weekday BETWEEN 0 AND 6',
  });

  pgm.addConstraint('group_schedules', 'group_schedules_whole_minutes_check', {
    check: 'EXTRACT(SECOND FROM start_time) = 0',
  });

  // Matches class_sessions: one class per group per day.
  pgm.addConstraint('group_schedules', 'group_schedules_group_id_weekday_unique', {
    unique: ['group_id', 'weekday'],
  });

  // "This teacher's classes on Saturdays": the Home page's question.
  pgm.createIndex('group_schedules', ['teacher_id', 'weekday']);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropTable('group_schedules');
};
