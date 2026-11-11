import type { ReactNode } from 'react';

import DirayaMark from './DirayaMark';
import ThemeToggle from './ThemeToggle';

// The frame shared by the standalone auth pages: tinted background, the
// Diraya logo, and a card. On phones the card fills the screen. Colours come
// from the theme tokens, so it follows light or dark like the rest of the app.
function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <main
      className="
        w-full min-h-screen

        flex flex-col items-center

        px-4 py-8
        bg-surface

        sm:justify-center
        sm:bg-primary-tint
      "
    >
      <div
        className="
          w-full max-w-[460px]

          bg-surface

          sm:px-10 sm:py-10
          sm:rounded-3xl
          sm:shadow-lg
        "
      >
        <div className="flex items-center gap-3">
          <DirayaMark className="h-9 w-9 text-primary-solid dark:text-white" />
          <span className="text-2xl font-bold leading-none">Diraya</span>
          <ThemeToggle className="ml-auto" />
        </div>

        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}

export default AuthPageShell;
