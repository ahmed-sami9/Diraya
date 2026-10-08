/**
 * Students. Each one is in exactly one grade, and in one of that grade's
 * groups once the teacher places them (until then group_id is NULL, shown as
 * "No group yet").
 *
 * More columns (phone, parent's phone...) are added by later migrations when
 * the "Add student" form is designed.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.createTable('students', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },

    teacher_id: {
      type: 'bigint',
      notNull: true,
      references: 'teachers',
      onDelete: 'CASCADE',
    },

    // No onDelete on purpose: the default (NO ACTION) makes the database
    // refuse to delete a grade that still has students. That is the same
    // rule the service checks, enforced a second time where it can't be
    // skipped.
    //
    // Why not RESTRICT? RESTRICT is checked immediately, NO ACTION at the end
    // of the statement. When a demo teacher is deleted, their grades and
    // their students are removed by the same statement; with RESTRICT the
    // grades could be checked before the students are gone, and the clean-up
    // would fail.
    grade_id: {
      type: 'bigint',
      notNull: true,
      references: 'grades',
    },

    // Deleting a group keeps its students, they just go back to "No group yet".
    group_id: {
      type: 'bigint',
      references: 'groups',
      onDelete: 'SET NULL',
    },

    full_name: {
      type: 'varchar(100)',
      notNull: true,
    },

    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  pgm.createIndex('students', 'teacher_id');
  pgm.createIndex('students', 'grade_id');
  pgm.createIndex('students', 'group_id');
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropTable('students');
};
