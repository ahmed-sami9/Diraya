/**
 * Adds Google sign-in support to teachers.
 *
 * google_id is Google's permanent ID for an account ("sub"). It is unique so
 * one Google account can only ever belong to one teacher, and nullable because
 * teachers who sign up with a password do not have one.
 *
 * password_hash is already nullable, which is what lets a teacher exist with
 * only a Google account.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.addColumn('teachers', {
    google_id: {
      type: 'text',
      unique: true,
    },
  });
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropColumn('teachers', 'google_id');
};
