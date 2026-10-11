/**
 * The teacher's private notes about a student ("rushes word problems",
 * "father prefers calls").
 *
 * Private by design: the only route that ever reads this table is the
 * teacher's own profile. The parent report must never select from it.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.createTable('student_notes', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },

    // For ownership checks in one WHERE, and so deleting a (demo) teacher
    // removes their notes.
    teacher_id: {
      type: 'bigint',
      notNull: true,
      references: 'teachers',
      onDelete: 'CASCADE',
    },

    // A note means nothing without its student: it goes with them.
    student_id: {
      type: 'bigint',
      notNull: true,
      references: 'students',
      onDelete: 'CASCADE',
    },

    // Same limit as the API and the form (1000 characters).
    text: {
      type: 'varchar(1000)',
      notNull: true,
    },

    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // The database refuses an empty or blank note even if a bug lets one past
  // the API's validation.
  pgm.addConstraint('student_notes', 'student_notes_text_not_blank', {
    check: "btrim(text) <> ''",
  });

  // "This student's notes, newest first": the one query this table serves.
  pgm.createIndex('student_notes', ['student_id', { name: 'created_at', sort: 'DESC' }]);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropTable('student_notes');
};
