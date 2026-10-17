/**
 * Exams and quizzes, and each student's result in them.
 *
 *   exams          one row per exam or quiz: "Unit 3 test, Grade 3, 8 Oct,
 *                  out of 40, pass mark 20". The event. Stored once.
 *   exam_results   one row per student per exam: scored 31.5, or absent.
 *                  The facts recorded at it.
 *
 * No row in exam_results means "not entered yet". That is not stored: it is
 * "students on the exam" minus "students with a result", worked out when read.
 * The same goes for averages, failed, full marks, upcoming vs past: nothing
 * summarized is stored, so nothing can disagree.
 *
 * Rules the DATABASE enforces (not just the code):
 *   - kind, "out of" and the pass mark are valid, and marks are whole or halves
 *   - one result per student per exam (saving twice is safe)
 *   - a student can only have a result for an exam of THEIR grade
 *   - a result's status and score agree (absent has no score, scored has one)
 *   - a score is never above the exam's "out of", even when "out of" is
 *     lowered later (see exam_results.max_mark)
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  /* ---------------------------------- exams --------------------------------- */

  pgm.createTable('exams', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },

    // For ownership checks in one WHERE, and so deleting a (demo) teacher
    // removes their exams.
    teacher_id: {
      type: 'bigint',
      notNull: true,
      references: 'teachers',
      onDelete: 'CASCADE',
    },

    // A whole grade sits an exam, not a group. Deleting a grade deletes its
    // exams: a grade can only be deleted once it has no students, so no
    // results are lost.
    grade_id: {
      type: 'bigint',
      notNull: true,
      references: 'grades',
      onDelete: 'CASCADE',
    },

    // Same limit as the form (80 characters).
    title: {
      type: 'varchar(80)',
      notNull: true,
    },

    kind: {
      type: 'varchar(10)',
      notNull: true,
    },

    // The calendar day in Egypt, not a timestamp (same as class_sessions).
    held_on: {
      type: 'date',
      notNull: true,
    },

    // "Out of": a whole number.
    max_mark: {
      type: 'integer',
      notNull: true,
    },

    // A mark, not a percent: numeric(5,1) is exact (no 19.999999), and the
    // CHECK below allows only whole and half marks.
    pass_mark: {
      type: 'numeric(5,1)',
      notNull: true,
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

  pgm.addConstraint('exams', 'exams_title_not_blank', {
    check: "btrim(title) <> ''",
  });

  // A varchar CHECK, not a Postgres enum: adding a kind later is a one-line
  // migration, and it matches attendance_records.status.
  pgm.addConstraint('exams', 'exams_kind_check', {
    check: "kind IN ('exam', 'quiz')",
  });

  pgm.addConstraint('exams', 'exams_max_mark_check', {
    check: 'max_mark BETWEEN 1 AND 1000',
  });

  pgm.addConstraint('exams', 'exams_pass_mark_check', {
    check: 'pass_mark > 0 AND pass_mark <= max_mark AND pass_mark * 2 = trunc(pass_mark * 2)',
  });

  // So exam_results can reference these pairs with composite foreign keys.
  // id alone is already unique, so these add no new rule; they only allow
  // the references.
  pgm.addConstraint('exams', 'exams_id_grade_id_unique', {
    unique: ['id', 'grade_id'],
  });
  pgm.addConstraint('exams', 'exams_id_max_mark_unique', {
    unique: ['id', 'max_mark'],
  });

  // The exams list: "this teacher's exams, newest first".
  pgm.sql('CREATE INDEX exams_teacher_id_held_on_index ON exams (teacher_id, held_on DESC)');

  /* ------------------------------ exam_results ------------------------------ */

  pgm.createTable('exam_results', {
    exam_id: {
      type: 'bigint',
      notNull: true,
    },

    student_id: {
      type: 'bigint',
      notNull: true,
    },

    // The grade both the exam and the student must share. Not new
    // information: it exists so the two foreign keys below can compare the
    // exam's grade with the student's (same idea as attendance_records).
    grade_id: {
      type: 'bigint',
      notNull: true,
    },

    // A copy of the exam's "out of", kept equal by the foreign key below
    // (ON UPDATE CASCADE). It lets a plain CHECK say "score <= max_mark".
    // When a teacher lowers "out of", the new value cascades into every
    // result, the CHECK runs on each one, and if any score is now too high
    // the whole UPDATE fails. No code path can forget the rule.
    max_mark: {
      type: 'integer',
      notNull: true,
    },

    // 'scored' or 'absent'. An explicit column, not "a NULL score means
    // absent": the meaning is in the schema, not in a comment, and a new
    // state ('excused') would be one more value.
    status: {
      type: 'varchar(10)',
      notNull: true,
    },

    score: {
      type: 'numeric(5,1)',
    },

    entered_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // One result per student per exam. Saving the same marks again updates
  // them (INSERT ... ON CONFLICT DO UPDATE) instead of duplicating them.
  pgm.addConstraint('exam_results', 'exam_results_pkey', {
    primaryKey: ['exam_id', 'student_id'],
  });

  pgm.addConstraint('exam_results', 'exam_results_status_check', {
    check: "status IN ('scored', 'absent')",
  });

  // Scored <=> has a score. (absent + 30, or scored + nothing, can't exist.)
  pgm.addConstraint('exam_results', 'exam_results_status_score_check', {
    check: "(status = 'scored') = (score IS NOT NULL)",
  });

  // The service looks for this name to answer SCORES_ABOVE_MAX_MARK when
  // "out of" is lowered below a saved mark. Keep the two in sync.
  pgm.addConstraint('exam_results', 'exam_results_score_check', {
    check: 'score >= 0 AND score <= max_mark AND score * 2 = trunc(score * 2)',
  });

  // The exam must be in the result's grade. Deleting an exam deletes its
  // results: they mean nothing without it.
  pgm.sql(`
    ALTER TABLE exam_results
    ADD CONSTRAINT exam_results_exam_fkey
    FOREIGN KEY (exam_id, grade_id) REFERENCES exams (id, grade_id)
    ON DELETE CASCADE
  `);

  // Keeps max_mark equal to the exam's (see the column above).
  pgm.sql(`
    ALTER TABLE exam_results
    ADD CONSTRAINT exam_results_max_mark_fkey
    FOREIGN KEY (exam_id, max_mark) REFERENCES exams (id, max_mark)
    ON UPDATE CASCADE ON DELETE CASCADE
  `);

  // The student must be in the exam's grade. Deleting a student deletes
  // their results (same as their attendance).
  pgm.sql(`
    ALTER TABLE exam_results
    ADD CONSTRAINT exam_results_student_fkey
    FOREIGN KEY (student_id, grade_id) REFERENCES students (id, grade_id)
    ON DELETE CASCADE
  `);

  // A student's results (the profile's Marks tab). The primary key starts
  // with exam_id, so it can't serve "WHERE student_id = $1" on its own.
  pgm.createIndex('exam_results', 'student_id');
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropTable('exam_results');
  pgm.dropTable('exams');
};
