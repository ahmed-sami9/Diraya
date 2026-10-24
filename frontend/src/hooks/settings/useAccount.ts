import { useCallback, useEffect, useState } from 'react';

import { isAbortError } from '../../api/apiClient';
import {
  changePassword,
  getAccount,
  updateProfile,
  type Account,
  type PasswordChangeInput,
  type ProfileInput,
} from '../../api/settings/account';
import { useAuth } from '../../context/AuthContext';

export type AccountState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; account: Account };

type AccountResult = { key: number } & (
  { status: 'error'; error: unknown } | { status: 'ready'; account: Account }
);

// The Settings page reads and writes the account ONLY through this hook.
// Same pattern as usePayments: "loading" is derived from whether the answer
// belongs to the current request, so there's no setState inside the effect.
export function useAccount() {
  const { setUser } = useAuth();

  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState<AccountResult | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getAccount(controller.signal)
      .then((account) => setResult({ key: reloadCount, status: 'ready', account }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        console.error(error);
        setResult({ key: reloadCount, status: 'error', error });
      });

    return () => controller.abort();
  }, [reloadCount]);

  const state: AccountState =
    result === null || result.key !== reloadCount ? { status: 'loading' } : result;

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  // Throws (ApiError) if the server refuses, so the form can say why.
  const saveProfile = useCallback(
    async (input: ProfileInput) => {
      const account = await updateProfile(input);

      setResult({ key: reloadCount, status: 'ready', account });
      // The sidebar and navbar read the name from AuthContext, not from here.
      setUser((previous) => (previous ? { ...previous, name: account.name } : previous));
    },
    [reloadCount, setUser]
  );

  const savePassword = useCallback((input: PasswordChangeInput) => changePassword(input), []);

  return { state, reload, saveProfile, changePassword: savePassword };
}
