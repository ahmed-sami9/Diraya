interface GripIconProps {
  className?: string;
}

// Six dots: "you can drag this".
function GripIcon({ className }: GripIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <circle
        cx="9"
        cy="6"
        r="1.6"
      />
      <circle
        cx="15"
        cy="6"
        r="1.6"
      />
      <circle
        cx="9"
        cy="12"
        r="1.6"
      />
      <circle
        cx="15"
        cy="12"
        r="1.6"
      />
      <circle
        cx="9"
        cy="18"
        r="1.6"
      />
      <circle
        cx="15"
        cy="18"
        r="1.6"
      />
    </svg>
  );
}

export default GripIcon;
