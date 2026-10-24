import { ApiError } from '../apiClient';
import { getCurrentUser } from '../auth/getCurrentUser';

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

// The contract the backend module will follow:
//   GET   /teacher/account           -> { account: Account }
//   PATCH /teacher/account/profile   -> { account: Account }
//   POST  /teacher/account/password  -> 204, and every OTHER session is signed out
//
// A wrong current password must be 400 INVALID_CURRENT_PASSWORD, never 401:
// apiClient reads every 401 as "your session has ended".

/* ---------------- TEMPORARY: stand-in until the backend exists ---------------- */
// Name, email and the demo flag are real (from /auth/me). Edits live in memory
// and reset on refresh. When the backend is ready, each body becomes one
// apiRequest(...) call and nothing else in the app changes.

// Flip to false to see the page as a Google-only teacher sees it.
const MOCK_HAS_PASSWORD = true;
// Type this as the current password to see the "wrong password" state.
const MOCK_WRONG_PASSWORD = 'wrong-password';

const mockEdits = new Map<string, { name: string; phone: string | null }>();

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function signedInUser(signal?: AbortSignal) {
  const user = await getCurrentUser(signal);

  if (!user) {
    throw new ApiError('Your session has ended. Please sign in again.', 401, 'UNAUTHENTICATED');
  }

  return user;
}

export async function getAccount(signal?: AbortSignal): Promise<Account> {
  const user = await signedInUser(signal);
  const edits = mockEdits.get(user.id);

  await wait(400);

  return {
    name: edits?.name ?? user.name,
    email: user.email,
    phone: edits?.phone ?? null,
    hasPassword: MOCK_HAS_PASSWORD && !user.isDemo,
    isDemo: Boolean(user.isDemo),
  };
}

export async function updateProfile(input: ProfileInput): Promise<Account> {
  const user = await signedInUser();

  await wait(600);
  mockEdits.set(user.id, { name: input.fullName, phone: input.phone });

  return getAccount();
}

export async function changePassword(input: PasswordChangeInput): Promise<void> {
  await wait(700);

  if (input.currentPassword === MOCK_WRONG_PASSWORD) {
    throw new ApiError('Your current password is incorrect.', 400, 'INVALID_CURRENT_PASSWORD');
  }
}
