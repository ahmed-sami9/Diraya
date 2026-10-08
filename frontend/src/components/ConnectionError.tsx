type ConnectionErrorProps = {
  onRetry: () => void;
};

function ConnectionError({ onRetry }: ConnectionErrorProps) {
  return (
    <main
      className="
        min-h-screen
        w-full
        bg-[#F9FAFF]
        flex
        flex-col
        relative
        overflow-hidden
      "
    >
      {/* Diraya branding */}
      <header
        className="
          absolute
          top-6
          left-6

          sm:top-8
          sm:left-10

          lg:top-10
          lg:left-14
        "
      >
        <div className="flex items-center gap-3">
          <img
            src="/diraya-logo-dark.png"
            alt="Diraya logo"
            className="
              w-11
              h-auto

              sm:w-12
            "
          />

          <div>
            <h1
              className="
                text-xl
                sm:text-2xl
                font-bold
                text-[#080D36]
                leading-tight
              "
            >
              Diraya
            </h1>

            <p
              className="
                mt-0.5
                text-xs
                sm:text-sm
                text-[#737A99]
              "
            >
              Educational Management System
            </p>
          </div>
        </div>
      </header>

      {/* Main error content */}
      <section
        className="
          flex-1
          flex
          items-center
          justify-center

          px-5
          pt-28
          pb-10
        "
      >
        <div
          className="
            w-full
            max-w-[760px]

            flex
            flex-col
            items-center
            text-center
          "
        >
          {/* Illustration */}
          <img
            src="/disconnected-illustration.png"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="
              w-[82%]
              max-w-[430px]
              h-auto
              object-contain

              sm:w-[70%]
              sm:max-w-[480px]

              lg:max-w-[520px]
            "
          />

          {/* Heading */}
          <h2
            className="
              mt-5

              text-[28px]
              sm:text-3xl
              lg:text-4xl

              font-bold
              leading-tight
              text-[#080D36]
            "
          >
            We&apos;re having trouble connecting
          </h2>

          {/* Description */}
          <p
            className="
              mt-4
              max-w-[620px]

              text-sm
              sm:text-base
              lg:text-lg

              leading-relaxed
              text-[#737A99]
            "
          >
            We couldn&apos;t connect to Diraya to open your workspace.
            <br className="hidden sm:block" />
            Check your connection or try again in a moment.
          </p>

          {/* Retry */}
          <button
            type="button"
            onClick={onRetry}
            className="
              mt-8

              min-w-[190px]
              h-[52px]

              flex
              items-center
              justify-center
              gap-3

              px-7

              bg-blue-600
              text-white

              rounded-xl

              text-base
              font-semibold

              shadow-sm

              cursor-pointer

              transition-all
              duration-200

              hover:bg-blue-700
              hover:shadow-md

              active:scale-[0.98]

              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-blue-500
              focus-visible:ring-offset-2
            "
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            Try again
          </button>
        </div>
      </section>
    </main>
  );
}

export default ConnectionError;
