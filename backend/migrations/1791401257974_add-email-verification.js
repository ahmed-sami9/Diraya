/**
 * Email verification for sign-up.
 *
 * teachers.email_verified says whether the teacher has proved they own their
 * email address. New password sign-ups start as false and cannot sign in
 * until they click the link we email them.
 *
 * email_verification_tokens holds those links, built the same way as
 * password_reset_tokens: only a hash is stored, each works once, and each
 * has an expiry.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.addColumn('teachers', {
    email_verified: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
  });

  // Teachers who already exist signed up before this rule existed. Mark them
  // as verified, otherwise they would be locked out of their accounts.
  pgm.sql('UPDATE teachers SET email_verified = TRUE');

  pgm.createTable('email_verification_tokens', {
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

    token_hash: {
      type: 'text',
      notNull: true,
      unique: true,
    },

    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },

    expires_at: {
      type: 'timestamptz',
      notNull: true,
    },

    // Set the moment the link is used, so it can never be used twice.
    used_at: {
      type: 'timestamptz',
    },
  });

  pgm.createIndex('email_verification_tokens', 'teacher_id');
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropTable('email_verification_tokens');
  pgm.dropColumn('teachers', 'email_verified');
};
