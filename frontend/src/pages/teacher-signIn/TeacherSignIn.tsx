import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import SignInLeftSection from './components/SignInLeftSection';
import SignInRightSection from './components/SignInRightSection';
import SignUpModal from './components/SignUpModal';
import ForgotPasswordModal from './components/ForgotPasswordModal';
import DirayaLogo from './components/DirayaLogo';

import CloseIcon from '../../components/icons/CloseIcon';

import { useAuth, type User } from '../../context/AuthContext';

// Same key SignInLeftSection uses to pick its welcome message.
const HAS_VISITED_KEY = 'diraya_hasVisited';

// Notes another page can leave for this one when it navigates here.
// The reset-password page uses both.
type SignInLocationState = {
  passwordWasReset?: boolean;
  openForgotPassword?: boolean;
  // Written by ProtectedRoute and read by PublicOnlyRoute: the page to
  // return to after signing in. It is not ours, so it must be kept.
  from?: string;
} | null;

const PASSWORD_RESET_NOTICE = 'Your password was updated. Sign in with your new password.';

const readHasVisited = () => {
  try {
    return localStorage.getItem(HAS_VISITED_KEY) === 'true';
  } catch {
    return false;
  }
};

const TeacherSignIn = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();

  // Read the note once, when the page opens. Keeping it in state means it
  // survives the clean-up effect below.
  const [arrival] = useState(() => (location.state as SignInLocationState) ?? {});

  // Small screens only (large screens always show both sections):
  // first-time visitors start on the overview so they learn what Diraya is,
  // returning visitors start on the sign-in form.
  // Someone arriving from the reset page came to sign in, so show the form.
  const [isLoggingIn, setIsLoggingIn] = useState(
    () => readHasVisited() || !!arrival.passwordWasReset || !!arrival.openForgotPassword
  );
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);

  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(!!arrival.openForgotPassword);
  // The email typed into the sign-in form, carried into the forgot window.
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');

  // Remove our two notes from the browser's history entry, so refreshing the
  // page does not show the message or reopen the window again. Anything else
  // in the state (the `from` page) is left in place.
  useEffect(() => {
    const state = location.state as SignInLocationState;

    if (state?.passwordWasReset || state?.openForgotPassword) {
      navigate(location.pathname, {
        replace: true,
        state: state.from ? { from: state.from } : null,
      });
    }
  }, [location.pathname, location.state, navigate]);

  /* ------------------------------ Handlers ------------------------------ */

  // The ONE place on this page that signs a teacher in. Password, Google and
  // demo sign-in all end here, after their own loading state has finished.
  //
  // There is no navigate() on purpose. This page sits inside PublicOnlyRoute,
  // which reacts the moment a user exists: it sends them to the page they
  // originally asked for (location.state.from) or to the dashboard.
  // Navigating here as well would override that "return to where you were".
  const handleAuthSuccess = (user: User) => {
    setUser(user);
  };

  const openLogin = () => {
    setIsLoggingIn(true);

    // The form renders at the top of the page, so bring it into view.
    window.scrollTo({ top: 0 });
  };

  const closeLogin = () => setIsLoggingIn(false);

  const openSignUp = () => setIsSignUpOpen(true);

  const closeSignUp = () => setIsSignUpOpen(false);

  const openForgotPassword = (email: string) => {
    setForgotPasswordEmail(email);
    setIsForgotPasswordOpen(true);
  };

  const closeForgotPassword = () => setIsForgotPasswordOpen(false);

  const switchToSignIn = () => {
    setIsSignUpOpen(false);
    setIsLoggingIn(true);
  };

  /* ------------------------------- Render ------------------------------- */

  return (
    <section
      className="
        relative
        w-full
        min-h-screen

        flex
        flex-col
        items-center

        bg-white
        pb-5

        overflow-x-hidden

        lg:min-h-screen
        lg:flex-row
        lg:items-stretch
        lg:bg-[#EEEFFE]
        lg:pb-0
        lg:overflow-x-visible
      "
    >
      {/* Top bar: logo plus the small-screen toggle for the sign-in form */}
      <div
        className={`
          ${
            isLoggingIn
              ? 'contents'
              : `
                relative
                w-full
                h-[78px]
                shrink-0

                sm:h-[82px]
                md:h-[86px]
              `
          }

          lg:contents
        `}
      >
        <DirayaLogo />

        {/* Form open: X closes it. Form closed: a labelled button opens it. */}
        <button
          type="button"
          onClick={isLoggingIn ? closeLogin : openLogin}
          aria-label={isLoggingIn ? 'Close sign-in form' : undefined}
          aria-expanded={isLoggingIn}
          className={`
            absolute
            top-7
            right-5
            z-20

            h-10

            flex
            items-center
            justify-center

            rounded-md

            cursor-pointer

            transition-colors
            duration-200

            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-[#3431E4]

            sm:right-[calc(50%-268px)]
            md:right-[max(2.5rem,calc(50%-350px))]

            lg:hidden

            ${
              isLoggingIn
                ? 'w-10 hover:bg-gray-100'
                : `
                  px-4
                  border
                  border-[#3431E4]
                  text-sm
                  font-semibold
                  text-[#3431E4]
                  hover:bg-indigo-50
                `
            }
          `}
        >
          {isLoggingIn ? <CloseIcon /> : 'Sign In'}
        </button>
      </div>

      <SignInLeftSection
        isOpen={isLoggingIn}
        onSignUp={openSignUp}
        onForgotPassword={openForgotPassword}
        onAuthSuccess={handleAuthSuccess}
        notice={arrival.passwordWasReset ? PASSWORD_RESET_NOTICE : null}
      />

      <SignInRightSection
        isOpen={isLoggingIn}
        onSignIn={openLogin}
        onSignUp={openSignUp}
      />

      <SignUpModal
        isOpen={isSignUpOpen}
        onClose={closeSignUp}
        onSwitchToSignIn={switchToSignIn}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Mounted only while open, so each opening starts fresh. */}
      {isForgotPasswordOpen && (
        <ForgotPasswordModal
          initialEmail={forgotPasswordEmail}
          onClose={closeForgotPassword}
        />
      )}
    </section>
  );
};

export default TeacherSignIn;
