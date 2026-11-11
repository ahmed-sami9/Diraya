type DirayaMarkProps = {
  className?: string;
};

// The Diraya mark: a D with an open book cut out. It draws in the text colour,
// so one component covers both themes, and the cut-out shows the background.
// Decorative: every place it appears also shows the name "Diraya" as text.
function DirayaMark({ className = '' }: DirayaMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M4 0H50C78 0 100 22 100 50S78 100 50 100H4Q0 100 0 96V4Q0 0 4 0Z M16 29Q16 27 19 27C31 26 44 34 47 44V75C37 67 27 65 16 69Z M53 44C56 34 69 26 81 27Q84 27 84 29V69C73 65 63 67 53 75Z"
      />
    </svg>
  );
}

export default DirayaMark;
