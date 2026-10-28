interface NotesIconProps {
  className?: string;
}

// A sticky note: the teacher's own notes (My notes).
function NotesIcon({ className }: NotesIconProps) {
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
      <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z" />
      <path d="M15 3v4a2 2 0 0 0 2 2h4" />
      <path d="M7 12h6" />
      <path d="M7 16h8" />
    </svg>
  );
}

export default NotesIcon;
