// The rules for the sign-in, sign-up and password forms, in one place.
//
// They match the backend (signUpSchema and resetPasswordSchema in
// auth.validation.ts). The server is what actually protects the data; these
// give a quick message before the request is sent. Change both together, or
// the form will accept values the server then rejects.

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const NAME_LENGTH = { min: 2, max: 100 } as const;
export const PASSWORD_LENGTH = { min: 8, max: 128 } as const;

// Each check returns the message to show, or undefined when the value is fine.

export function emailError(email: string): string | undefined {
  const trimmed = email.trim();

  if (!trimmed) return 'Email is required';
  if (!EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email';
  return undefined;
}

export function fullNameError(fullName: string): string | undefined {
  const trimmed = fullName.trim();

  if (!trimmed) return 'Full name is required';
  if (trimmed.length < NAME_LENGTH.min) {
    return `Full name must be at least ${NAME_LENGTH.min} characters`;
  }
  if (trimmed.length > NAME_LENGTH.max) {
    return `Full name must be ${NAME_LENGTH.max} characters or fewer`;
  }
  if (/\p{N}/u.test(trimmed)) return 'Full name cannot contain numbers';
  return undefined;
}

// For a password being chosen (sign-up, reset). Signing in only needs one.
export function newPasswordError(password: string): string | undefined {
  if (!password) return 'Password is required';
  if (password.length < PASSWORD_LENGTH.min) {
    return `Password must be at least ${PASSWORD_LENGTH.min} characters`;
  }
  if (password.length > PASSWORD_LENGTH.max) {
    return `Password must be ${PASSWORD_LENGTH.max} characters or fewer`;
  }
  return undefined;
}
