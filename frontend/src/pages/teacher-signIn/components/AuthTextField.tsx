import { useState, type ComponentType, type InputHTMLAttributes, type Ref } from 'react';
import { EyeIcon } from '../../../components/icons/index';

interface AuthTextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  id: string;
  label: string;
  // Pass the icon component itself (icon={MailIcon}), not an element.
  icon: ComponentType<{ className?: string }>;
  error?: string;
  // Classes for the outer wrapper, used for the spacing between fields.
  className?: string;
  // Lets a parent reach the <input>, for example to focus it. It is not
  // listed in the function below, so it travels inside `inputProps`.
  ref?: Ref<HTMLInputElement>;
}

// Only one set of border/focus colours is applied at a time, so the error
// state is never overridden by the default hover or focus colours.
const fieldStateClasses = (hasError: boolean) =>
  hasError
    ? 'border-red-500 focus:border-red-500 focus:ring-red-100'
    : 'border-gray-200 hover:border-gray-300 focus:border-[#3431E4] focus:ring-indigo-100';

// One labelled input with a leading icon and an error message underneath.
// With type="password" it also renders its own show/hide toggle.
function AuthTextField({
  id,
  label,
  icon: Icon,
  error,
  className = '',
  type = 'text',
  disabled,
  ...inputProps
}: AuthTextFieldProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  const isPassword = type === 'password';
  const hasError = !!error;
  const errorId = `${id}-error`;

  return (
    <div className={`w-full flex flex-col ${className}`}>
      <label
        htmlFor={id}
        className="text-sm font-semibold mb-1.5"
      >
        {label}
      </label>

      <div className="relative w-full">
        <Icon
          className="
            absolute
            left-4
            top-1/2
            -translate-y-1/2
            pointer-events-none
          "
        />

        <input
          {...inputProps}
          id={id}
          type={isPassword && isRevealed ? 'text' : type}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          className={`
            w-full h-[50px]
            pl-14 ${isPassword ? 'pr-12' : 'pr-4'}
            border rounded-md
            bg-white
            shadow-sm shadow-gray-200
            text-sm text-slate-800
            placeholder:text-gray-400
            outline-none
            transition-all duration-200

            focus:ring-2

            disabled:bg-gray-50
            disabled:cursor-not-allowed

            xl:h-[46px]

            ${fieldStateClasses(hasError)}
          `}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setIsRevealed((prev) => !prev)}
            disabled={disabled}
            aria-label={`${isRevealed ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
            aria-pressed={isRevealed}
            className="
              absolute
              right-3
              top-1/2
              -translate-y-1/2

              flex items-center justify-center
              w-8 h-8
              rounded-md
              transition-colors

              hover:bg-gray-100

              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-[#3431E4]

              disabled:cursor-not-allowed
            "
          >
            <EyeIcon />
          </button>
        )}
      </div>

      {error && (
        <p
          id={errorId}
          className="text-xs text-red-500 mt-1.5 pl-1"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default AuthTextField;
