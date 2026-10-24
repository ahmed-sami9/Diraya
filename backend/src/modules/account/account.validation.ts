import { z } from 'zod';

import { validateBody } from '../../middlware/validate';

// The same rules as the frontend forms (ProfileCard, PasswordCard). The
// frontend checks them for a quick message; these protect the data.

// Same rule as students' phones; the frontend sends them normalized.
const egyptMobile = z.string().regex(/^01[0125]\d{8}$/, 'Expected an Egyptian mobile number');

// .strict(): any other field (email!) is a 400, not silently ignored.
export const profileSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .transform((value) => value.replace(/\s+/g, ' '))
      .pipe(z.string().min(2).max(100)),
    phone: egyptMobile.nullable(),
  })
  .strict();

export type ProfileInput = z.infer<typeof profileSchema>;

// Password limits match sign-up and reset.
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(8).max(128),
  })
  .strict()
  .refine((input) => input.newPassword !== input.currentPassword, {
    message: 'The new password must be different from the current one',
    path: ['newPassword'],
  });

export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

export const validateProfile = validateBody(profileSchema, 'Invalid profile data');

export const validatePasswordChange = validateBody(passwordChangeSchema, 'Invalid password data');
