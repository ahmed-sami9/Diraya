import React from 'react';
type MailIconProbs = {
  className?: string;
};

const MailIcon = (props: MailIconProbs) => {
  return (
    <svg
      className={props.className}
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#949494"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
      <rect
        x="2"
        y="4"
        width="20"
        height="16"
        rx="2"
      />
    </svg>
  );
};

export default MailIcon;
