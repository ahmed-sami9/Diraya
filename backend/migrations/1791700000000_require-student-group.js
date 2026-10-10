/**
 * Every student is in a group, and that group is in the student's grade.
 *
 * A group is the real class: it will own the weekly schedule, the sessions
 * and the attendance sheets. A student outside every group would appear on
 * no attendance sheet, so that state is made impossible here instead of
 * being handled (or forgotten) in code.
 *
 * 1. Every grade gets at least one group ("Group 1" when it has none).
 * 2. Students without a group join their grade's oldest group.
 * 3. students.group_id becomes NOT NULL.
 * 4. A composite foreign key (group_id, grade_id) -> groups (id, grade_id)
 *    replaces the plain one, so the database itself refuses a student whose
 *    group belongs to another grade.
 *
 * The new foreign key keeps the default NO ACTION, like students.grade_id:
 * a group with students can't be deleted, and deleting a demo teacher (which
 * removes groups and students in one statement) still works, because NO
 * ACTION is checked at the end of the statement.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  pgm.sql(`
    INSERT INTO groups (teacher_id, grade_id, name)
    SELECT g.teacher_id, g.id, 'Group 1'
    FROM grades g
    WHERE NOT EXISTS (SELECT 1 FROM groups gr WHERE gr.grade_id = g.id)
  `);

  pgm.sql(`
    UPDATE students s
    SET group_id = (
      SELECT gr.id
      FROM groups gr
      WHERE gr.grade_id = s.grade_id
      ORDER BY gr.created_at, gr.id
      LIMIT 1
    )
    WHERE s.group_id IS NULL
  `);

  pgm.alterColumn('students', 'group_id', { notNull: true });

  // A foreign key can only point at columns that are unique together.
  // id alone is already unique, so this adds no rule, it only lets
  // (id, grade_id) be referenced.
  pgm.addConstraint('groups', 'groups_id_grade_id_unique', {
    unique: ['id', 'grade_id'],
  });

  pgm.dropConstraint('students', 'students_group_id_fkey');

  pgm.sql(`
    ALTER TABLE students
    ADD CONSTRAINT students_group_in_grade_fkey
    FOREIGN KEY (group_id, grade_id) REFERENCES groups (id, grade_id)
  `);
};

/**
 * Back to optional groups. The groups created by up() stay: they can't be
 * told apart from groups the teacher made, and an extra group loses nothing.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropConstraint('students', 'students_group_in_grade_fkey');

  pgm.sql(`
    ALTER TABLE students
    ADD CONSTRAINT students_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE SET NULL
  `);

  pgm.dropConstraint('groups', 'groups_id_grade_id_unique');

  pgm.alterColumn('students', 'group_id', { notNull: false });
};
