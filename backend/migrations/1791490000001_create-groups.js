/**
 * Groups: the classes inside a grade ("Group A", "Saturday group").
 *
 * The schedule and attendance will belong to a group. They get their own
 * tables when the grade page is built, so this one only holds what every
 * group has: a name and its grade.
 *
 * Deleting a grade deletes its groups. The service only allows that when the
 * grade has no students left.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.createTable('groups', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },

    // Stored here too (not only through the grade) so every query can check
    // ownership with a plain "WHERE teacher_id = $1", and so demo clean-up
    // can delete by teacher directly.
    teacher_id: {
      type: 'bigint',
      notNull: true,
      references: 'teachers',
      onDelete: 'CASCADE',
    },

    grade_id: {
      type: 'bigint',
      notNull: true,
      references: 'grades',
      onDelete: 'CASCADE',
    },

    name: {
      type: 'varchar(60)',
      notNull: true,
    },

    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Group names are unique inside one grade ("Group A" can exist in Grade 1
  // and in Grade 2, but only once in each).
  pgm.sql(`
    CREATE UNIQUE INDEX groups_grade_id_name_unique
    ON groups (grade_id, lower(name))
  `);

  pgm.createIndex('groups', 'teacher_id');
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropTable('groups');
};
