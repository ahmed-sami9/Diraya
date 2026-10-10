/**
 * What the "Add student" form needs, plus the student code.
 *
 * students.code is the human-friendly id shown in the table and used on
 * paper: "26-0042" = joined in 2026, the 42nd student this teacher added.
 * It is given once and never changes, even if the student changes grade.
 *
 * teachers.next_student_number is the counter that hands those numbers
 * out. Taking a number is one UPDATE ... RETURNING, which locks that
 * teacher's row until the transaction ends, so two students added at the
 * same moment can never get the same number.
 *
 * Phones are stored normalized: 11 digits, "01012345678".
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.addColumn('teachers', {
    next_student_number: {
      type: 'integer',
      notNull: true,
      default: 1,
    },
  });

  pgm.addColumns('students', {
    // Nullable for one moment only: filled for existing rows below, then
    // made NOT NULL.
    code: {
      type: 'varchar(20)',
    },

    // The person a teacher calls about absences and payments.
    parent_phone: {
      type: 'varchar(11)',
    },

    phone: {
      type: 'varchar(11)',
    },

    // Private to the teacher. Never sent to parents.
    notes: {
      type: 'varchar(500)',
    },
  });

  // Students that already exist (none expected yet) get codes in the order
  // they were added, and each teacher's counter continues after them.
  pgm.sql(`
    WITH numbered AS (
      SELECT
        id,
        teacher_id,
        created_at,
        ROW_NUMBER() OVER (PARTITION BY teacher_id ORDER BY created_at, id) AS n
      FROM students
    )
    UPDATE students s
    SET code = to_char(numbered.created_at, 'YY') || '-' || lpad(numbered.n::text, 4, '0')
    FROM numbered
    WHERE s.id = numbered.id
  `);

  pgm.sql(`
    UPDATE teachers t
    SET next_student_number = counts.total + 1
    FROM (SELECT teacher_id, COUNT(*) AS total FROM students GROUP BY teacher_id) counts
    WHERE t.id = counts.teacher_id
  `);

  pgm.alterColumn('students', 'code', { notNull: true });

  // A code is unique per teacher (two teachers can both have a 26-0001).
  pgm.addConstraint('students', 'students_teacher_id_code_unique', {
    unique: ['teacher_id', 'code'],
  });

  // The database refuses badly formed numbers even if a bug lets one past
  // the API's validation. Existing rows have no number yet, so NULL passes.
  pgm.addConstraint('students', 'students_parent_phone_format', {
    check: "parent_phone ~ '^01[0125][0-9]{8}$'",
  });

  pgm.addConstraint('students', 'students_phone_format', {
    check: "phone ~ '^01[0125][0-9]{8}$'",
  });
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropConstraint('students', 'students_phone_format');
  pgm.dropConstraint('students', 'students_parent_phone_format');
  pgm.dropConstraint('students', 'students_teacher_id_code_unique');
  pgm.dropColumns('students', ['code', 'parent_phone', 'phone', 'notes']);
  pgm.dropColumn('teachers', 'next_student_number');
};
