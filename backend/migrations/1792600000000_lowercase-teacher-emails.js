/**
 * One account per email, whatever the capitals.
 *
 * Before this, "Ahmed@x.com" and "ahmed@x.com" could sign up as two teachers,
 * and password login missed a Google account saved in lower case. The app now
 * lower-cases every email it receives (auth.validation.ts); this migration
 * brings the stored ones in line and makes the database refuse any other.
 *
 * If two accounts already differ only by case, the migration stops with their
 * emails instead of guessing which one to keep: merge or delete one by hand,
 * then run it again.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.sql(`
    DO $$
    DECLARE clashes text;
    BEGIN
      SELECT string_agg(emails, '; ') INTO clashes
      FROM (
        SELECT string_agg(email, ', ') AS emails
        FROM teachers
        GROUP BY lower(email)
        HAVING COUNT(*) > 1
      ) dup;

      IF clashes IS NOT NULL THEN
        RAISE EXCEPTION 'Teachers whose emails differ only by case: %', clashes;
      END IF;
    END $$;
  `);

  pgm.sql('UPDATE teachers SET email = lower(email) WHERE email <> lower(email)');

  pgm.addConstraint('teachers', 'teachers_email_lowercase', {
    check: 'email = lower(email)',
  });
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  // The lower-cased emails stay: the original capitals are not kept anywhere.
  pgm.dropConstraint('teachers', 'teachers_email_lowercase');
};
