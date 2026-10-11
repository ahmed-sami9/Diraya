/**
 * Attendance: class sessions and each student's mark in them.
 *
 *   class_sessions       one row per class that met: Group A on Sat 18 Oct.
 *                        The "event": when, which group. Stored once.
 *   attendance_records   one row per student per session: present, late,
 *                        absent or excused. The "facts recorded at it".
 *
 * Nothing is summarized here. Rates, "last session", the profile's squares
 * and the grade cards' numbers are all computed from these two tables when
 * they are read, so they can never disagree with each other.
 *
 * Rules the DATABASE enforces (not just the code):
 *   - one session per group per day (a double click can't make two)
 *   - a session's group belongs to the session's grade
 *   - one mark per student per session (saving the sheet twice is safe)
 *   - a student can only be marked in a session of THEIR grade (make-up
 *     students from another group are fine, another grade is not)
 *   - a status is one of the four known values
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  // students (id, grade_id) and groups (id, grade_id) must be unique pairs
  // for the composite foreign keys below to point at them. id alone is
  // already unique, so this adds no new rule; it only allows the reference.
  // (groups already has groups_id_grade_id_unique.)
  pgm.addConstraint('students', 'students_id_grade_id_unique', {
    unique: ['id', 'grade_id'],
  });

  /* ------------------------------ class_sessions ------------------------------ */

  pgm.createTable('class_sessions', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },

    // For ownership checks in one WHERE, and so deleting a (demo) teacher
    // removes their sessions.
    teacher_id: {
      type: 'bigint',
      notNull: true,
      references: 'teachers',
      onDelete: 'CASCADE',
    },

    // Stored next to group_id so attendance_records can check "same grade"
    // with a foreign key. The composite key below keeps it honest.
    grade_id: {
      type: 'bigint',
      notNull: true,
    },

    group_id: {
      type: 'bigint',
      notNull: true,
    },

    // The calendar day in Egypt (Africa/Cairo), not a UTC timestamp: "the
    // class of Sat 18 Oct" must not move to Friday because of time zones.
    held_on: {
      type: 'date',
      notNull: true,
    },

    // When it started, if known (from the group's schedule, or typed).
    start_time: {
      type: 'time',
    },

    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },

    // Set when the sheet is changed after the day it was held: the
    // "edited later" stamp the profile can show.
    edited_at: {
      type: 'timestamptz',
    },
  });

  // One session per group per day. Taking attendance twice for the same
  // class finds the existing session instead of creating a second one.
  pgm.addConstraint('class_sessions', 'class_sessions_group_id_held_on_unique', {
    unique: ['group_id', 'held_on'],
  });

  // The session's group must be in the session's grade.
  //
  // NO ACTION (the default) on delete: a group that has held sessions can't
  // be deleted, because its history would go with it. (Deleting a demo
  // teacher still works: their sessions and groups go in the same statement,
  // and NO ACTION is checked at the end of it.)
  pgm.sql(`
    ALTER TABLE class_sessions
    ADD CONSTRAINT class_sessions_group_in_grade_fkey
    FOREIGN KEY (group_id, grade_id) REFERENCES groups (id, grade_id)
  `);

  // So attendance_records can reference (id, grade_id) together.
  pgm.addConstraint('class_sessions', 'class_sessions_id_grade_id_unique', {
    unique: ['id', 'grade_id'],
  });

  // "This teacher's sessions in October", newest first.
  pgm.createIndex('class_sessions', ['teacher_id', 'held_on']);

  /* ---------------------------- attendance_records ---------------------------- */

  pgm.createTable('attendance_records', {
    session_id: {
      type: 'bigint',
      notNull: true,
    },

    student_id: {
      type: 'bigint',
      notNull: true,
    },

    // The grade both the session and the student must share. Not new
    // information: it exists only so the two foreign keys below can compare
    // the session's grade with the student's.
    grade_id: {
      type: 'bigint',
      notNull: true,
    },

    status: {
      type: 'varchar(10)',
      notNull: true,
    },

    // Why they were absent or excused, if the teacher noted it.
    reason: {
      type: 'varchar(200)',
    },

    // Came to another group's session (of the same grade). Recorded when the
    // sheet is saved, NOT worked out later from the student's current group:
    // if they change groups next month, this history must not change.
    is_make_up: {
      type: 'boolean',
      notNull: true,
      default: false,
    },

    marked_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // One mark per student per session. Saving the same sheet again updates
  // the marks (INSERT ... ON CONFLICT DO UPDATE) instead of duplicating them.
  pgm.addConstraint('attendance_records', 'attendance_records_pkey', {
    primaryKey: ['session_id', 'student_id'],
  });

  pgm.addConstraint('attendance_records', 'attendance_records_status_check', {
    check: "status IN ('present', 'late', 'absent', 'excused')",
  });

  // Deleting a session deletes its marks: they mean nothing without it.
  pgm.sql(`
    ALTER TABLE attendance_records
    ADD CONSTRAINT attendance_records_session_fkey
    FOREIGN KEY (session_id, grade_id) REFERENCES class_sessions (id, grade_id)
    ON DELETE CASCADE
  `);

  // The student must be in the same grade as the session. Deleting a student
  // deletes their marks.
  pgm.sql(`
    ALTER TABLE attendance_records
    ADD CONSTRAINT attendance_records_student_fkey
    FOREIGN KEY (student_id, grade_id) REFERENCES students (id, grade_id)
    ON DELETE CASCADE
  `);

  // A student's history (the profile). The primary key starts with
  // session_id, so it can't serve "WHERE student_id = $1" on its own.
  pgm.createIndex('attendance_records', 'student_id');
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropTable('attendance_records');
  pgm.dropTable('class_sessions');
  pgm.dropConstraint('students', 'students_id_grade_id_unique');
};
