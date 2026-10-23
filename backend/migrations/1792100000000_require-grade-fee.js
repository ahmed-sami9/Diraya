/**
 * Every grade has a monthly fee (0 for a free grade): payments can't work out
 * what's due without one. Grades saved without a fee start at 0.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.sql('UPDATE grades SET monthly_fee = 0 WHERE monthly_fee IS NULL');
  pgm.alterColumn('grades', 'monthly_fee', { notNull: true });
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.alterColumn('grades', 'monthly_fee', { notNull: false });
};
