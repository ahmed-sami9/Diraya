import { useTheme } from '../context/ThemeContext';
import { resolveTheme } from '../utils/theme';
import MoonIcon from './icons/MoonIcon';
import SunIcon from './icons/SunIcon';

/**
 * One-click light/dark switch for the signed-out pages. It saves the same
 * preference as Settings → Appearance, so the dashboard opens in the theme
 * picked here. The icon shows where a click takes you: a moon in light mode.
 */
function ThemeToggle({ className = '' }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  // "System" counts as whatever the device shows right now
  const isDark = resolveTheme(preference) === 'dark';
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      onClick={() => setPreference(isDark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className={`
        flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center
        rounded-md text-ink-secondary
        transition-colors duration-200
        hover:bg-surface-hover hover:text-ink
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
        ${className}
      `}
    >
      {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}

export default ThemeToggle;
