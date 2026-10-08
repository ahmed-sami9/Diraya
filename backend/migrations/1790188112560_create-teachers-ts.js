/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable('teachers', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },

    full_name: {
      type: 'varchar(100)',
      notNull: true,
    },

    email: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },

    password_hash: {
      type: 'text',
    },
  });
};

export const down = (pgm) => {
  pgm.dropTable('teachers');
};
/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
