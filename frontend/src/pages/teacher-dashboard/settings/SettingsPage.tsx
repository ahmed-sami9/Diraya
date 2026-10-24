import SectionError from '../../../components/SectionError';
import { useAccount } from '../../../hooks/settings/useAccount';

import AppearanceCard from './components/AppearanceCard';
import PasswordCard from './components/PasswordCard';
import ProfileCard from './components/ProfileCard';

// The account sections need the server; Appearance doesn't, so it shows
// even while the account is loading or failed to load.
function SettingsPage() {
  const { state, reload, saveProfile, changePassword } = useAccount();

  return (
    <div className="flex flex-col gap-6">
      {state.status === 'error' ? (
        <SectionError
          title="We couldn’t load your account"
          error={state.error}
          onRetry={reload}
        />
      ) : state.status === 'loading' ? (
        <div
          role="status"
          className="flex flex-col gap-6"
        >
          <div className="h-[360px] animate-pulse rounded-2xl border border-border bg-surface" />
          <div className="h-[420px] animate-pulse rounded-2xl border border-border bg-surface" />
          <span className="sr-only">Loading your account</span>
        </div>
      ) : (
        <>
          <ProfileCard
            account={state.account}
            onSave={saveProfile}
          />
          <PasswordCard
            account={state.account}
            onChangePassword={changePassword}
          />
        </>
      )}

      <AppearanceCard />
    </div>
  );
}

export default SettingsPage;
