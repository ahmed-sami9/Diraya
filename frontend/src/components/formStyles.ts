// Class strings shared by the dashboard's forms and dialogs, so every input
// and button looks and behaves the same. (Like authPageClasses.ts does for
// the sign-in pages.)

export const inputClasses = (hasError: boolean) => `
  h-[46px] w-full
  rounded-[10px] border bg-surface
  px-3.5
  text-sm text-ink
  outline-none
  transition-colors
  placeholder:text-ink-muted
  focus:ring-[3px]
  disabled:cursor-not-allowed disabled:bg-surface-hover
  ${
    hasError
      ? 'border-danger focus:ring-danger-tint'
      : 'border-border hover:border-ink-muted/40 focus:border-primary focus:ring-primary-tint'
  }
`;

const buttonBase = `
  h-11 rounded-[10px] px-[18px]
  text-sm font-semibold
  cursor-pointer
  transition-colors
  focus-visible:outline-2 focus-visible:outline-offset-2
  disabled:cursor-not-allowed
`;

export const primaryButtonClasses = `
  ${buttonBase}
  bg-primary text-white
  hover:bg-primary-hover
  focus-visible:outline-primary
  disabled:opacity-70
`;

export const secondaryButtonClasses = `
  ${buttonBase}
  border border-border bg-surface text-ink
  hover:bg-surface-hover
  focus-visible:outline-primary
  disabled:opacity-60
`;

export const dangerButtonClasses = `
  ${buttonBase}
  bg-danger text-white
  hover:opacity-90
  focus-visible:outline-danger
  disabled:opacity-70
`;

// The red box at the top of a form for errors that aren't about one field.
export const formErrorClasses =
  'rounded-lg border border-danger/20 bg-danger-tint px-4 py-3 text-sm text-danger';
