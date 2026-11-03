// Shared looks for the standalone auth pages (reset password, confirm email).

export const primaryButtonClasses = `
  w-full h-[50px]

  flex items-center justify-center gap-2
  px-6

  bg-primary-solid
  text-white
  text-sm
  font-semibold

  rounded-md
  shadow-sm

  cursor-pointer
  transition-all duration-200

  hover:bg-primary-hover
  hover:shadow-md

  active:scale-[0.995]

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-primary
  focus-visible:ring-offset-2 focus-visible:ring-offset-surface

  disabled:cursor-not-allowed
  disabled:opacity-80
  disabled:hover:bg-primary-solid
  disabled:hover:shadow-sm

  xl:h-[46px]
`;

export const textLinkClasses = `
  text-sm
  font-semibold
  text-primary

  transition-colors

  hover:text-primary-hover
  hover:underline

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-primary
  focus-visible:ring-offset-2 focus-visible:ring-offset-surface

  rounded-sm
`;
