import type { ReactNode } from 'react';

// The frame shared by the standalone auth pages: lavender background, the
// Diraya logo, and a white card. On phones the card fills the screen.
function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <main
      className="
        w-full min-h-screen

        flex flex-col items-center

        px-4 py-8
        bg-white

        sm:justify-center
        sm:bg-[#EEEFFE]
      "
    >
      <div
        className="
          w-full max-w-[460px]

          bg-white

          sm:px-10 sm:py-10
          sm:rounded-3xl
          sm:shadow-lg
        "
      >
        <div className="flex items-center gap-3">
          <img
            src="/diraya-logo-dark.png"
            alt=""
            aria-hidden="true"
            className="w-9 h-9"
          />
          <span className="text-2xl font-bold leading-none">Diraya</span>
        </div>

        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}

export default AuthPageShell;
