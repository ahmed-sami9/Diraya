import { Suspense, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import TeacherSidebar from './TeacherSidebar';
import TeacherNavbar from './TeacherNavbar';
import PageLoader from '../../components/PageLoader';

import { useAuth } from '../../context/AuthContext';

function TeacherDashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Small screens only: the sidebar is a slide-in drawer.
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const teacherName = user?.name ?? '';

  const handleLogout = async () => {
    await logout();

    navigate('/teacher/sign-in', { replace: true });
  };

  return (
    <div className="min-h-screen bg-page text-ink lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      {/* Dimmed backdrop behind the open drawer.
          Always rendered, so it can fade in and out with the drawer. */}
      <div
        aria-hidden="true"
        onClick={() => setSidebarOpen(false)}
        className={`
          fixed inset-0 z-30 bg-ink/40
          transition-opacity duration-300 ease-out
          motion-reduce:transition-none
          lg:hidden
          ${isSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}
        `}
      />

      {/* Permanent sidebar: fixed drawer on small screens, sticky column from lg */}
      <TeacherSidebar
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
        teacherName={teacherName}
        teacherRole="Teacher"
        onLogout={handleLogout}
      />

      <div className="flex min-w-0 flex-col">
        {/* Permanent navbar: sticks to the top while the page scrolls */}
        <TeacherNavbar
          teacherName={teacherName}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        {/* Changing page. A slow page shows the loader after a short wait;
            a fast page appears with no loader at all. */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default TeacherDashboardLayout;
