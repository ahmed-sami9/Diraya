import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import ServiceStatusBanner from './ServiceStatusBanner';

function PublicOnlyRoute() {
  const { user, isAuthChecking, authCheckError, retryAuthCheck } = useAuth();

  const location = useLocation();

  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-[#3431E4] animate-spin" />
      </div>
    );
  }

  if (user) {
    const state = location.state as {
      from?: string;
    } | null;

    return (
      <Navigate
        to={state?.from ?? '/teacher'}
        replace
      />
    );
  }

  // The server couldn't say whether this browser is signed in. Most likely
  // it isn't (it's on the sign-in page, after all), and a wrong guess is
  // harmless here: a signed-in teacher just sees the sign-in page until the
  // server is back. So show the page, with a notice explaining why signing
  // in may fail. The notice clears itself once the server answers.
  if (authCheckError) {
    return (
      <>
        <Outlet />
        <ServiceStatusBanner onRetry={retryAuthCheck} />
      </>
    );
  }

  return <Outlet />;
}

export default PublicOnlyRoute;
