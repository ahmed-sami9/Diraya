import type { User } from '../../../context/AuthContext';
import useDemoLogin from '../../../hooks/auth/useDemoLogin.ts';

interface SignInRightSectionProps {
  isOpen: boolean;
  onSignIn: () => void;
  // For the small-screen "Try the demo" button.
  onAuthSuccess: (user: User) => void;
}

// Shared by the two small-screen call-to-action buttons.
const ctaBaseClasses = `
  h-11
  px-6

  text-sm
  font-semibold

  rounded-md

  cursor-pointer
  transition-colors
  duration-200

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-primary
  focus-visible:ring-offset-2 focus-visible:ring-offset-surface
`;

const SignInRightSection = ({ isOpen, onSignIn, onAuthSuccess }: SignInRightSectionProps) => {
  const { tryDemo, isDemoLoading, demoError } = useDemoLogin(onAuthSuccess);

  return (
    <section
      aria-label="Diraya features"
      className={`
        relative

        w-full

        flex
        flex-col
        items-center

        mx-auto

        px-5
        pb-10

        transition-colors
        duration-300

        ${
          isOpen
            ? `
              mt-10
              pt-11
              bg-page
              rounded-t-[32px]
            `
            : `
              mt-0
              pt-4
              bg-surface
              rounded-none
              sm:pt-5
              md:pt-6
            `
        }

        sm:max-w-[600px]
        sm:px-8

        md:max-w-[900px]
        md:px-10

        lg:w-[57%]
        lg:min-h-screen
        lg:justify-center-safe
        lg:max-w-none
        lg:mt-0
        lg:px-8
        lg:pt-7
        lg:pb-6
        lg:gap-y-6
        short:pt-5
        short:pb-4
        short:gap-y-4
        lg:bg-primary-tint
        lg:rounded-none

        xl:w-[64%]
        xl:items-start
        xl:px-12
        xl:pt-7
        xl:gap-y-4
      `}
    >
      {/* Drag-handle bar: small screens only, while the sign-in form is open */}
      {isOpen && (
        <div
          aria-hidden="true"
          className="
            absolute
            top-0
            left-1/2

            -translate-x-1/2
            -translate-y-1/2

            w-12
            h-1

            rounded-full
            bg-border-strong

            lg:hidden
          "
        />
      )}

      {/* Heading */}
      <div
        className="
          w-full
          pl-1

          sm:pl-0
          sm:max-w-[600px]

          md:max-w-[700px]

          lg:max-w-[620px]

          xl:max-w-[800px]
          xl:ml-4
        "
      >
        <h2
          className="
            text-[25px]
            font-bold
            leading-[1.17]

            text-ink

            sm:text-[27px]
            md:text-3xl
            lg:text-3xl
            xl:text-4xl
          "
        >
          Run your private lessons,
          <br />
          <span className="text-primary-hover">all in one place</span>
        </h2>

        <p
          className="
            w-full
            max-w-[390px]

            mt-3

            text-[14px]
            font-medium
            leading-relaxed
            text-ink-muted

            sm:max-w-[520px]
            md:max-w-[600px]
            lg:max-w-[560px]

            xl:max-w-[750px]
            xl:text-[17px]
          "
        >
          Students, groups, attendance, exams and payments for private tutors,
          <span className="hidden sm:inline">
            <br />
          </span>{' '}
          with progress reports that parents get on WhatsApp.
        </p>

        {/* Calls to action: small screens only, while the sign-in form is closed */}
        {!isOpen && (
          <div
            className="
              flex
              flex-wrap
              gap-3

              mt-5

              lg:hidden
            "
          >
            <button
              type="button"
              onClick={onSignIn}
              className={`
                ${ctaBaseClasses}

                bg-primary-solid
                text-white

                shadow-sm

                hover:bg-primary-hover
              `}
            >
              Sign in
            </button>

            {/* "Create account" stays one tap away, inside the sign-in form. */}
            <button
              type="button"
              onClick={tryDemo}
              disabled={isDemoLoading}
              aria-busy={isDemoLoading}
              className={`
                ${ctaBaseClasses}

                bg-primary-tint
                text-primary

                hover:bg-primary/15
                disabled:cursor-not-allowed disabled:opacity-60
              `}
            >
              {isDemoLoading ? 'Loading demo…' : 'Try the demo'}
            </button>
          </div>
        )}

        {!isOpen && demoError && (
          <p
            role="alert"
            className="mt-3 text-xs font-medium text-danger lg:hidden"
          >
            {demoError}
          </p>
        )}
      </div>

      {/* Main dashboard illustration */}
      {/* Small screens: same width box as the heading, so both start at one line. */}
      <div
        className="
          w-full
          pl-1

          mt-7

          overflow-visible

          sm:pl-0
          sm:max-w-[600px]
          sm:mt-8

          md:max-w-[700px]
          md:mt-9

          lg:flex
          lg:items-center
          lg:justify-center
          lg:pl-0
          lg:max-w-none
          lg:mt-0

          xl:justify-start
          xl:mt-2
          xl:ml-[1%]
        "
      >
        {/* The real Overview page, framed as a browser window: the light one in
            the light theme, the dark one in the dark theme. width/height keep
            the space reserved while it loads. Below lg it's widened by the
            file's transparent shadow, so the frame lines up with the heading. */}
        <img
          src="/signin-preview-light.webp"
          alt="Diraya's Overview page: students, today's attendance, papers to mark, payments overdue and today's schedule"
          width={1718}
          height={1148}
          draggable={false}
          className="
            h-auto
            object-contain
            select-none
            dark:hidden

            w-[107%]
            max-w-none
            -ml-[3.6%]

            lg:w-full
            lg:ml-0
            lg:max-w-[720px]
            xl:max-w-[860px]

            short:w-auto
            short:max-h-[calc(100vh-215px)]
          "
        />
        <img
          src="/signin-preview-dark.webp"
          alt="Diraya's Overview page: students, today's attendance, papers to mark, payments overdue and today's schedule"
          width={1720}
          height={1164}
          draggable={false}
          className="
            hidden
            h-auto
            object-contain
            select-none
            dark:block

            w-[107%]
            max-w-none
            -ml-[3.6%]

            lg:w-full
            lg:ml-0
            lg:max-w-[720px]
            xl:max-w-[860px]

            short:w-auto
            short:max-h-[calc(100vh-215px)]
          "
        />
      </div>
    </section>
  );
};

export default SignInRightSection;
