import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { AlertCircleIcon } from '../../components/icons/index.ts';
import AuthPageShell from '../../components/AuthPageShell.tsx';
import { primaryButtonClasses } from '../../components/authPageClasses.ts';
import { useAuth } from '../../context/AuthContext';
import { verifyEmail, InvalidVerificationLinkError } from '../../api/emailVerification.ts';

// What the page is showing:
//   verifying -> sending the link's token to the server
//   invalid   -> the link is wrong, already used or expired
//   failed    -> the server could not be reached, so we cannot tell
type Status = 'verifying' | 'invalid' | 'failed';

const SIGN_IN_PATH = '/teacher/sign-in';
const HOME_PATH = '/teacher';

// Opened from the link in the confirmation email:
//   /teacher/verify-email?token=...
//
// There is nothing to fill in. The page sends the token, and when the server
// accepts it the teacher is signed in and taken to their dashboard.
function TeacherVerifyEmail() {
  const navigate = useNavigate();
  const { user, setUser, isAuthChecking } = useAuth();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token') ?? '';

  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'invalid');

  // The link works only once, so the request must be sent only once. In
  // development React runs effects twice on purpose; without this flag the
  // second run would use an already-used link and show an error.
  const hasRequested = useRef(false);

  useEffect(() => {
    if (!token || hasRequested.current) return;

    // Wait for the app's own "is anyone signed in?" check to finish. If it
    // finished after us, its answer (nobody) would overwrite the user we are
    // about to set.
    if (isAuthChecking) return;

    hasRequested.current = true;

    verifyEmail(token)
      .then((verifiedUser) => {
        setUser(verifiedUser);

        navigate(HOME_PATH, { replace: true });
      })
      .catch((error) => {
        console.error(error);

        setStatus(error instanceof InvalidVerificationLinkError ? 'invalid' : 'failed');
      });
  }, [token, isAuthChecking, navigate, setUser]);

  if (status === 'verifying') {
    return (
      <AuthPageShell>
        <div
          role="status"
          className="flex flex-col items-center gap-4 py-10"
        >
          <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-[#3431E4] animate-spin" />
          <p className="text-sm font-medium text-gray-500">Confirming your email...</p>
        </div>
      </AuthPageShell>
    );
  }

  const isInvalid = status === 'invalid';

  return (
    <AuthPageShell>
      <span
        className="
          flex items-center justify-center
          w-12 h-12
          rounded-full
          bg-red-50
          text-red-500
        "
      >
        <AlertCircleIcon className="w-6 h-6" />
      </span>

      <h1 className="mt-4 text-2xl font-bold leading-tight text-slate-800">
        {isInvalid ? 'This link no longer works' : "We couldn't confirm your email"}
      </h1>

      <p className="mt-2 text-sm leading-relaxed text-gray-600">
        {isInvalid
          ? 'Confirmation links work once and expire after 24 hours. If you already confirmed your email, you can just sign in. If not, sign in with your email and password and we will offer to send a new link.'
          : 'The server could not be reached. Check your connection and try again.'}
      </p>

      {isInvalid ? (
        <Link
          to={user ? HOME_PATH : SIGN_IN_PATH}
          className={`${primaryButtonClasses} mt-6`}
        >
          {user ? 'Go to your dashboard' : 'Go to sign in'}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={`${primaryButtonClasses} mt-6`}
        >
          Try again
        </button>
      )}
    </AuthPageShell>
  );
}

export default TeacherVerifyEmail;
