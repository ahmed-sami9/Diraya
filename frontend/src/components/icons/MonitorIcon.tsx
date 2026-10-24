interface MonitorIconProps {
  className?: string;
}

function MonitorIcon({ className }: MonitorIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect
        width="20"
        height="14"
        x="2"
        y="3"
        rx="2"
      />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  );
}

export default MonitorIcon;
