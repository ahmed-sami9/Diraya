/**
 * Grades: the top level of how a teacher organises students.
 *
 *   Grade ("Grade 3 Secondary")  ->  Groups ("Group A")  ->  Students
 *
 * Each grade belongs to one teacher. Deleting the teacher deletes their
 * grades (needed for demo clean-up, see add-demo-teachers).
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.createTable('grades', {
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

    // Same limit as the "Add grade" form (60 characters).
    name: {
      type: 'varchar(60)',
      notNull: true,
    },

    // Whole Egyptian pounds. NULL means "use the default fee from Settings".
    monthly_fee: {
      type: 'integer',
      check: 'monthly_fee BETWEEN 0 AND 100000',
    },

    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },

    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // A teacher can't have two grades with the same name. lower() makes
  // "Grade 3" and "grade 3" count as the same name.
  //
  // The service looks for this exact index name to answer GRADE_NAME_TAKEN,
  // so keep the two in sync. It also serves as the index for "all grades of
  // this teacher", because teacher_id is its first column.
  pgm.sql(`
    CREATE UNIQUE INDEX grades_teacher_id_name_unique
    ON grades (teacher_id, lower(name))
  `);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropTable('grades');
};
