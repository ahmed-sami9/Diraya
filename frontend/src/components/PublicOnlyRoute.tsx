import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import ConnectionError from './ConnectionError';

function PublicOnlyRoute() {
  const { user, isAuthChecking, authCheckError } = useAuth();

  const location = useLocation();

  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-[#3431E4] animate-spin" />
      </div>
    );
  }

  if (authCheckError) {
    return <ConnectionError onRetry={() => window.location.reload()} />;
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

  return <Outlet />;
}

export default PublicOnlyRoute;
