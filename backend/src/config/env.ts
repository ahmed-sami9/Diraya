import { z } from 'zod';

// Checks the server's settings once, at start-up. A missing or weak value
// stops the deploy with a full list, instead of failing later at the first
// request that needs it (the first sign-up email, the first Google sign-in).

// `KEY=` in a .env file means "not set", not "set to nothing".
const blankAsMissing = (value: unknown) => (value === '' ? undefined : value);

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'], {
      error: 'must be development, test or production',
    })
    .default('development'),
  PORT: z.preprocess(
    blankAsMissing,
    z.coerce.number({ error: 'must be a port number' }).int().min(1).max(65535).optional()
  ),
  DATABASE_URL: z
    .string({ error: 'is required' })
    .regex(/^postgres(ql)?:\/\//, 'must be a postgres:// connection string'),
  // Anyone who guesses it can sign their own session tokens.
  JWT_SECRET: z.string({ error: 'is required' }).min(32, 'must be at least 32 characters'),
  FRONTEND_ORIGIN: z.preprocess(
    blankAsMissing,
    z.url({ protocol: /^https?$/, error: 'must be a full address, e.g. https://app.example.com' }).optional()
  ),
  GOOGLE_CLIENT_ID: z.preprocess(blankAsMissing, z.string().optional()),
  GOOGLE_CLIENT_SECRET: z.preprocess(blankAsMissing, z.string().optional()),
  RESEND_API_KEY: z.preprocess(blankAsMissing, z.string().optional()),
  EMAIL_FROM: z.preprocess(blankAsMissing, z.string().optional()),
});

export type Env = z.infer<typeof envSchema>;

// Optional on a laptop (emails print in the terminal), required for real users.
const REQUIRED_IN_PRODUCTION = [
  'FRONTEND_ORIGIN',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'RESEND_API_KEY',
  'EMAIL_FROM',
] as const;

export class EnvError extends Error {
  constructor(public problems: string[]) {
    super(`The server's settings are invalid:\n  - ${problems.join('\n  - ')}`);
  }
}

// Messages name the variable, never its value: values can be secrets.
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  const problems = result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`);

  // Checked on the raw input, so these are listed even when other values failed.
  if (blankAsMissing(source.NODE_ENV) === 'production') {
    for (const key of REQUIRED_IN_PRODUCTION) {
      if (blankAsMissing(source[key]) === undefined) {
        problems.push(`${key} is required in production`);
      }
    }

    if (source.FRONTEND_ORIGIN?.startsWith('http://')) {
      problems.push('FRONTEND_ORIGIN must use https in production');
    }
  }

  if (!result.success || problems.length > 0) {
    throw new EnvError(problems);
  }

  return result.data;
}
