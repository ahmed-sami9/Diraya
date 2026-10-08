// Helpers for reading errors that PostgreSQL sends back through `pg`.
//
// Some rules are enforced by the database itself (a unique index, a foreign
// key). When one is broken, `pg` throws an error with a 5-character `code`
// and the name of the `constraint`. These helpers turn that into a yes/no
// question, so a service can swap the raw error for a clear AppError.
//
// Codes: https://www.postgresql.org/docs/current/errcodes-appendix.html

type PgError = {
  code?: string;
  constraint?: string;
};

function isPgError(error: unknown): error is PgError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

// 23505: a row with the same value already exists (UNIQUE).
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  return isPgError(error) && error.code === '23505' && error.constraint === constraint;
}

// 23503: the row is still referenced by another table (FOREIGN KEY).
export function isForeignKeyViolation(error: unknown, constraint: string): boolean {
  return isPgError(error) && error.code === '23503' && error.constraint === constraint;
}
