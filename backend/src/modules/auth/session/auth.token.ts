import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const JWT_ISSUER = 'diraya';
const JWT_AUDIENCE = 'diraya-api';

const tokenPayloadSchema = z.object({
  userId: z.string().regex(/^[1-9]\d*$/),
  role: z.literal('teacher'),
  sid: z.string().uuid(),
  exp: z.number().int().positive(),
});

export type TokenPayload = {
  userId: string;
  role: 'teacher';
  sid: string;
};

export type VerifiedTokenPayload = z.infer<typeof tokenPayloadSchema>;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET environment variable is missing.');
  }

  return secret;
}

export function generateAccessToken(payload: TokenPayload, expiresAt: Date): string {
  return jwt.sign(
    {
      ...payload,
      exp: Math.floor(expiresAt.getTime() / 1000),
    },
    getJwtSecret(),
    {
      algorithm: 'HS256',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  );
}

export function verifyAccessToken(token: string): VerifiedTokenPayload {
  const decoded = jwt.verify(token, getJwtSecret(), {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });

  const result = tokenPayloadSchema.safeParse(decoded);

  if (!result.success) {
    throw new jwt.JsonWebTokenError('Invalid authentication token payload');
  }

  return result.data;
}

export function isInvalidTokenError(error: unknown): boolean {
  return (
    error instanceof jwt.JsonWebTokenError ||
    error instanceof jwt.TokenExpiredError ||
    error instanceof jwt.NotBeforeError
  );
}
