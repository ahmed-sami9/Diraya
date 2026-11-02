import { Outlet } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';

// /teacher/settings. Each section is a child route shown in <Outlet />. The
// section menu joins here once there is a second section to switch to.
function SettingsLayout() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Manage your account, sign-in and appearance."
      />

      <Outlet />
    </div>
  );
}

export default SettingsLayout;
