import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import ConnectionError from './ConnectionError';
type ProtectedRouteProps = {
  allowedRole?: 'teacher' | 'student';
};

function ProtectedRoute({ allowedRole }: ProtectedRouteProps) {
  const { user, isAuthChecking, authCheckError } = useAuth();

  const location = useLocation();

  // We haven't finished asking the backend
  // whether the cookie/session is valid.
  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-[#3431E4] animate-spin" />
      </div>
    );
  }

  // Don't incorrectly tell the user they're logged out
  // if the backend itself could not be reached.
  if (authCheckError) {
    return <ConnectionError onRetry={() => window.location.reload()} />;
  }

  // We KNOW the user isn't authenticated.
  if (!user) {
    return (
      <Navigate
        to="/teacher/sign-in"
        replace
        state={{
          from: location.pathname + location.search,
        }}
      />
    );
  }

  // Logged in, but wrong type of account.
  if (allowedRole && user.role !== allowedRole) {
    return (
      <Navigate
        to="/unauthorized"
        replace
      />
    );
  }

  // Authentication passed.
  // Render whatever protected child route matched.
  return <Outlet />;
}

export default ProtectedRoute;
