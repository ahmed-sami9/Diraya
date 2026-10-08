/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.createTable('teacher_sessions', {
    id: {
      type: 'uuid',
      primaryKey: true,
    },

    teacher_id: {
      type: 'bigint',
      notNull: true,
      references: 'teachers',
      onDelete: 'CASCADE',
    },

    remember_me: {
      type: 'boolean',
      notNull: true,
      default: false,
    },

    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },

    last_activity_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },

    expires_at: {
      type: 'timestamptz',
      notNull: true,
    },

    revoked_at: {
      type: 'timestamptz',
    },
  });

  pgm.createIndex('teacher_sessions', 'teacher_id');
  pgm.createIndex('teacher_sessions', 'expires_at');
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropTable('teacher_sessions');
};
