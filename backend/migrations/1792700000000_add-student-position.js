/**
 * The teacher's own order of students within a group (dragged on the grade page).
 *
 * NULL means "not placed yet": those students come after the placed ones,
 * alphabetically. So every existing group looks exactly as before until the
 * teacher first reorders it, and nothing needs backfilling.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.addColumn('students', {
    position: { type: 'integer' },
  });

  pgm.addConstraint('students', 'students_position_check', {
    check: 'position >= 0',
  });
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropColumn('students', 'position');
};
