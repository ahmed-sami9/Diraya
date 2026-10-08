import FeatureItem from '../../../components/FeautureItem.tsx';

interface SignInRightSectionProps {
  isOpen: boolean;
  onSignIn: () => void;
  onSignUp: () => void;
}

const FEATURES = [
  {
    icon: '/icons/open-book.png',
    title: 'All-in-one',
    description: 'Run everything in one place.',
  },
  {
    icon: '/icons/green-sheild.png',
    title: 'Safe',
    description: 'Keep student data protected.',
  },
  {
    icon: '/icons/colorful-insight.png',
    title: 'Insightful',
    description: 'See progress at a glance.',
  },
  {
    icon: '/icons/orange-clock.png',
    title: 'Saves time',
    description: 'Cut hours of manual work.',
  },
];

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
  focus-visible:ring-[#3431E4]
  focus-visible:ring-offset-2
`;

const SignInRightSection = ({ isOpen, onSignIn, onSignUp }: SignInRightSectionProps) => {
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
              bg-[#F7F7FF]
              rounded-t-[32px]
            `
            : `
              mt-0
              pt-4
              bg-white
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
        lg:max-w-none
        lg:mt-0
        lg:px-8
        lg:pt-7
        lg:pb-6
        lg:gap-y-6
        lg:bg-[#EEEFFE]
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
            bg-[#D7D8F8]

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

            text-slate-950

            sm:text-[27px]
            md:text-3xl
            lg:text-3xl
            xl:text-4xl
          "
        >
          Everything you need,
          <br />
          in one <span className="text-[#312FC1]">smart workspace</span>
        </h2>

        <p
          className="
            w-full
            max-w-[390px]

            mt-3

            text-[14px]
            font-medium
            leading-relaxed
            text-[#81818D]

            sm:max-w-[520px]
            md:max-w-[600px]
            lg:max-w-[560px]

            xl:max-w-[750px]
            xl:text-[17px]
          "
        >
          Manage students, track attendance, conduct exams,
          <span className="hidden sm:inline">
            <br />
          </span>{' '}
          and handle payments &mdash; all in one place.
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

                bg-[#3431E4]
                text-white

                shadow-sm

                hover:bg-[#2926C2]
              `}
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={onSignUp}
              className={`
                ${ctaBaseClasses}

                bg-white
                text-slate-800

                border
                border-gray-300

                hover:bg-gray-50
                hover:border-gray-400
              `}
            >
              Create account
            </button>
          </div>
        )}
      </div>

      {/* Main dashboard illustration */}
      <div
        className="
          w-full

          flex
          items-center
          justify-center

          mt-7

          overflow-visible

          sm:mt-8
          md:mt-9

          lg:mt-0

          xl:justify-start
          xl:mt-2
          xl:ml-[1%]
        "
      >
        <img
          src="/teacher-signInPage-illustrator.png"
          alt="Illustrated preview of the Diraya teacher management dashboard"
          draggable={false}
          className="
            object-contain
            select-none

            w-[108%]
            max-w-[520px]
            -translate-x-[1.5%]

            sm:w-[112%]
            sm:max-w-[640px]

            md:w-[110%]
            md:max-w-[720px]
            md:-translate-x-[1.25%]

            lg:w-[115%]
            lg:max-w-[730px]
            lg:translate-x-0
            lg:-mt-[15px]

            xl:w-[98%]
            xl:max-w-[780px]
            xl:-mt-[22px]
          "
        />
      </div>

      {/* Feature items */}
      <div
        className="
          w-full
          mt-6
          p-4

          grid
          grid-cols-1
          gap-4

          sm:grid-cols-2
          sm:gap-5
          sm:p-5

          md:max-w-[700px]

          lg:max-w-none
          lg:mt-3
          lg:border-t
          lg:border-indigo-200/50
          lg:px-0
          lg:pt-6
          lg:pb-2
          lg:gap-10

          xl:grid-cols-4
          xl:max-w-[950px]
          xl:mt-0
          xl:gap-0
          xl:divide-x
          xl:divide-indigo-200/50
          xl:[&>*]:px-5
        "
      >
        {FEATURES.map((feature) => (
          <FeatureItem
            key={feature.title}
            icon={feature.icon}
            alt=""
            title={feature.title}
            description={feature.description}
          />
        ))}
      </div>
    </section>
  );
};

export default SignInRightSection;
