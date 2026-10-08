interface PaymentsIconProps {
  className?: string;
}

function PaymentsIcon({ className }: PaymentsIconProps) {
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
        y="5"
        rx="2"
      />
      <path d="M2 10h20" />
    </svg>
  );
}

export default PaymentsIcon;
