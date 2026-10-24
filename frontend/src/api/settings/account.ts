import { apiRequest } from '../apiClient';

// The signed-in teacher's own account, as the Settings page shows it.
export type Account = {
  name: string;
  email: string;
  // 11 digits, "01012345678", or null when not given.
  phone: string | null;
  // false for Google-only and demo accounts: there's no password to change.
  hasPassword: boolean;
  isDemo: boolean;
};

export type ProfileInput = {
  fullName: string;
  phone: string | null;
};

export type PasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
};

// Error codes the forms react to (backend: modules/account/account.errors.ts):
//   INVALID_CURRENT_PASSWORD (400): shown under the current-password field
//   INVALID_INPUT (400), NO_PASSWORD (409), DEMO_ACCOUNT (403): shown as is

// GET /teacher/account
export async function getAccount(signal?: AbortSignal): Promise<Account> {
  const { account } = await apiRequest<{ account: Account }>('GET', '/teacher/account', {
    signal,
  });

  return account;
}

// PATCH /teacher/account/profile: answers with the saved account.
export async function updateProfile(input: ProfileInput): Promise<Account> {
  const { account } = await apiRequest<{ account: Account }>('PATCH', '/teacher/account/profile', {
    body: input,
  });

  return account;
}

// POST /teacher/account/password: 204, and every OTHER session is signed out.
export async function changePassword(input: PasswordChangeInput): Promise<void> {
  await apiRequest<null>('POST', '/teacher/account/password', { body: input });
}
