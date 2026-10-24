/**
 * The teacher's own phone, edited in Settings. Optional, so existing teachers
 * stay valid. Stored normalized like students' phones: 11 digits, "01012345678".
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.addColumn('teachers', {
    phone: {
      type: 'varchar(11)',
    },
  });

  // The same rule the API checks, kept by the database too.
  pgm.addConstraint('teachers', 'teachers_phone_format', {
    check: "phone ~ '^01[0125][0-9]{8}$'",
  });
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropConstraint('teachers', 'teachers_phone_format');
  pgm.dropColumn('teachers', 'phone');
};
