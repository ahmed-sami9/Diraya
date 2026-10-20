/**
 * Payments, how each one is split over months, and per-month skips/notes.
 * Due, paid and status are never stored: they're computed when read.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const up = (pgm) => {
  /* --------------------------------- students -------------------------------- */

  pgm.addColumns('students', {
    discount_percent: {
      type: 'integer',
      notNull: true,
      default: 0,
    },

    discount_reason: {
      type: 'varchar(200)',
    },
  });

  pgm.addConstraint('students', 'students_discount_percent_check', {
    check: 'discount_percent BETWEEN 0 AND 100',
  });

  /* --------------------------------- payments -------------------------------- */

  pgm.createTable('payments', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },

    // No teacher_id / grade_id: both come from the student, so they can't disagree.
    student_id: {
      type: 'bigint',
      notNull: true,
      references: 'students',
      onDelete: 'CASCADE',
    },

    amount: {
      type: 'integer',
      notNull: true,
    },

    // When the money was handed over (created_at is when it was entered).
    paid_on: {
      type: 'date',
      notNull: true,
    },

    method: {
      type: 'varchar(20)',
      notNull: true,
    },

    note: {
      type: 'varchar(300)',
    },

    // Sent once per dialog, so a double click can't record twice.
    request_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
    },

    // Payments are voided, never deleted.
    voided_at: {
      type: 'timestamptz',
    },

    void_reason: {
      type: 'varchar(200)',
    },

    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  pgm.addConstraint('payments', 'payments_amount_check', {
    check: 'amount BETWEEN 1 AND 1000000',
  });

  pgm.addConstraint('payments', 'payments_method_check', {
    check: "method IN ('cash', 'instapay', 'vodafone-cash')",
  });

  pgm.addConstraint('payments', 'payments_void_check', {
    check: '(voided_at IS NULL) = (void_reason IS NULL)',
  });

  pgm.createIndex('payments', 'student_id');

  /* ------------------------------ payment_months ----------------------------- */

  pgm.createTable('payment_months', {
    payment_id: {
      type: 'bigint',
      notNull: true,
      references: 'payments',
      onDelete: 'CASCADE',
    },

    // Always the 1st of the month.
    month: {
      type: 'date',
      notNull: true,
    },

    amount: {
      type: 'integer',
      notNull: true,
    },
  });

  pgm.addConstraint('payment_months', 'payment_months_pkey', {
    primaryKey: ['payment_id', 'month'],
  });

  pgm.addConstraint('payment_months', 'payment_months_month_check', {
    check: 'extract(day FROM month) = 1',
  });

  pgm.addConstraint('payment_months', 'payment_months_amount_check', {
    check: 'amount > 0',
  });

  /* ------------------------------ student_months ----------------------------- */

  pgm.createTable('student_months', {
    student_id: {
      type: 'bigint',
      notNull: true,
      references: 'students',
      onDelete: 'CASCADE',
    },

    month: {
      type: 'date',
      notNull: true,
    },

    skip_reason: {
      type: 'varchar(200)',
    },

    note: {
      type: 'varchar(300)',
    },

    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  pgm.addConstraint('student_months', 'student_months_pkey', {
    primaryKey: ['student_id', 'month'],
  });

  pgm.addConstraint('student_months', 'student_months_month_check', {
    check: 'extract(day FROM month) = 1',
  });

  // No row means a normal month, so an empty row is never kept.
  pgm.addConstraint('student_months', 'student_months_not_empty_check', {
    check: 'skip_reason IS NOT NULL OR note IS NOT NULL',
  });
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
export const down = (pgm) => {
  pgm.dropTable('student_months');
  pgm.dropTable('payment_months');
  pgm.dropTable('payments');
  pgm.dropConstraint('students', 'students_discount_percent_check');
  pgm.dropColumns('students', ['discount_percent', 'discount_reason']);
};
