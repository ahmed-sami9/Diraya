import { Outlet } from 'react-router-dom';

// /teacher/settings. Each section is a child route shown in <Outlet />. The
// section menu joins here once there is a second section to switch to.
function SettingsLayout() {
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Settings</h1>
        <p className="text-sm text-ink-secondary">Manage your account, sign-in and appearance.</p>
      </header>

      <Outlet />
    </div>
  );
}

export default SettingsLayout;
