/**
 * Demo accounts.
 *
 * "Try the demo" creates a temporary teacher for each visitor, so visitors
 * never share data. Two columns make that possible:
 *
 *   is_demo     marks those temporary teachers
 *   created_at  lets the server delete demo teachers once they are a day old
 *
 * IMPORTANT for every table added later (students, courses, quizzes...):
 * give its teacher_id column `onDelete: 'CASCADE'`, as teacher_sessions has.
 * Deleting an old demo teacher must also delete everything that teacher
 * owned, otherwise the clean-up fails or leaves orphaned rows behind.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.addColumn('teachers', {
    is_demo: {
      type: 'boolean',
      notNull: true,
      default: false,
    },

    // Existing teachers get the time this migration runs, which is fine:
    // the value is only ever read for demo teachers.
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Only demo rows are indexed, so the clean-up query stays fast without
  // adding weight to normal teachers.
  pgm.createIndex('teachers', 'created_at', {
    name: 'teachers_demo_created_at_index',
    where: 'is_demo',
  });
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropIndex('teachers', 'created_at', { name: 'teachers_demo_created_at_index' });
  pgm.dropColumn('teachers', 'created_at');
  pgm.dropColumn('teachers', 'is_demo');
};
