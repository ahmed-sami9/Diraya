/**
 * The teacher's own notes (My notes): reminders about themselves, not a
 * student ("print the Unit 3 test", "call the center about the projector").
 * Notes about a student live in student_notes.
 *
 *   pinned       kept at the top of the list (the only "importance" there is)
 *   updated_at   when the TEXT last changed; pinning doesn't count as an edit,
 *                so the UI can say "edited 3 Oct" truthfully
 *
 * Rules the DATABASE enforces:
 *   - text is never empty or blank, and at most 1000 characters
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.createTable('teacher_notes', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },

    // Ownership in one WHERE, and deleting a (demo) teacher removes their notes.
    teacher_id: {
      type: 'bigint',
      notNull: true,
      references: 'teachers',
      onDelete: 'CASCADE',
    },

    // Same limit as the API and the form (1000 characters), like student notes.
    text: {
      type: 'varchar(1000)',
      notNull: true,
    },

    pinned: {
      type: 'boolean',
      notNull: true,
      default: false,
    },

    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },

    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  pgm.addConstraint('teacher_notes', 'teacher_notes_text_not_blank', {
    check: "btrim(text) <> ''",
  });

  // "This teacher's notes, pinned first, newest first": the list's one query.
  pgm.createIndex('teacher_notes', [
    'teacher_id',
    { name: 'pinned', sort: 'DESC' },
    { name: 'created_at', sort: 'DESC' },
  ]);
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropTable('teacher_notes');
};
