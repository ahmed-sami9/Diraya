import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import SignInLeftSection from './components/SignInLeftSection';
import SignInRightSection from './components/SignInRightSection';
import SignUpModal from './components/SignUpModal';
import DirayaLogo from './components/DirayaLogo';

import CloseIcon from '../../components/icons/CloseIcon';

import { useAuth, type User } from '../../context/AuthContext';

// Same key SignInLeftSection uses to pick its welcome message.
const HAS_VISITED_KEY = 'diraya_hasVisited';

const readHasVisited = () => {
  try {
    return localStorage.getItem(HAS_VISITED_KEY) === 'true';
  } catch {
    return false;
  }
};

const TeacherSignIn = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  // Small screens only (large screens always show both sections):
  // first-time visitors start on the overview so they learn what Diraya is,
  // returning visitors start on the sign-in form.
  const [isLoggingIn, setIsLoggingIn] = useState(readHasVisited);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);

  /* ------------------------------ Handlers ------------------------------ */

  const handleAuthSuccess = (user: User) => {
    // React now knows who is logged in.
    setUser(user);

    // Leave the authentication page for the teacher dashboard.
    navigate('/teacher', { replace: true });
  };

  const openLogin = () => {
    setIsLoggingIn(true);

    // The form renders at the top of the page, so bring it into view.
    window.scrollTo({ top: 0 });
  };

  const closeLogin = () => setIsLoggingIn(false);

  const openSignUp = () => setIsSignUpOpen(true);

  const closeSignUp = () => setIsSignUpOpen(false);

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
        onAuthSuccess={handleAuthSuccess}
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
    </section>
  );
};

export default TeacherSignIn;
