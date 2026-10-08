/**
 * One row per "forgot password" request.
 *
 * Only a hash of the reset token is stored, never the token itself, for the
 * same reason passwords are hashed: if this table ever leaks, the rows cannot
 * be turned back into working reset links.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.createTable('password_reset_tokens', {
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

  pgm.createIndex('password_reset_tokens', 'teacher_id');
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropTable('password_reset_tokens');
};
