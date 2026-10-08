// Shared looks for the standalone auth pages (reset password, confirm email).

export const primaryButtonClasses = `
  w-full h-[50px]

  flex items-center justify-center gap-2
  px-6

  bg-[#3431E4]
  text-white
  text-sm
  font-semibold

  rounded-md
  shadow-sm

  cursor-pointer
  transition-all duration-200

  hover:bg-[#2926C2]
  hover:shadow-md

  active:scale-[0.995]

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-[#3431E4]
  focus-visible:ring-offset-2

  disabled:cursor-not-allowed
  disabled:opacity-80
  disabled:hover:bg-[#3431E4]
  disabled:hover:shadow-sm

  xl:h-[46px]
`;

export const textLinkClasses = `
  text-sm
  font-semibold
  text-[#3431E4]

  transition-colors

  hover:text-[#2926C2]
  hover:underline

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-[#3431E4]
  focus-visible:ring-offset-2

  rounded-sm
`;
