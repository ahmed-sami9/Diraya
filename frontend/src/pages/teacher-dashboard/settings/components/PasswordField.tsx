import { useId, useState, type Ref } from 'react';

import EyeIcon from '../../../../components/icons/EyeIcon';
import EyeOffIcon from '../../../../components/icons/EyeOffIcon';
import { inputClasses } from '../../../../components/formStyles';

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  // Tells password managers which saved password to fill or update.
  autoComplete: 'current-password' | 'new-password';
  // The error replaces the hint while there is one.
  error?: string;
  hint?: string;
  disabled: boolean;
  inputRef?: Ref<HTMLInputElement>;
}

// A password input with its own show/hide button.
function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  error,
  hint,
  disabled,
  inputRef,
}: PasswordFieldProps) {
  const id = useId();
  const [isVisible, setIsVisible] = useState(false);

  const message = error ?? hint;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-sm font-semibold text-ink"
      >
        {label}
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          name={autoComplete}
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          autoComplete={autoComplete}
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={message ? `${id}-message` : undefined}
          className={`${inputClasses(Boolean(error))} pr-12`}
        />

        {/* The label stays the same; aria-pressed says whether it's on. */}
        <button
          type="button"
          onClick={() => setIsVisible((visible) => !visible)}
          disabled={disabled}
          aria-label={`Show ${label.toLowerCase()}`}
          aria-pressed={isVisible}
          className="
            absolute right-0.5 top-1/2 -translate-y-1/2
            flex h-11 w-11 items-center justify-center
            rounded-[9px] text-ink-muted
            cursor-pointer
            transition-colors
            hover:text-ink
            focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary
            disabled:cursor-not-allowed disabled:opacity-50
          "
        >
          {isVisible ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
      </div>

      {message && (
        <p
          id={`${id}-message`}
          className={`text-[13px] ${error ? 'text-danger' : 'text-ink-secondary'}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

export default PasswordField;
