import { useId } from 'react';

import MonitorIcon from '../../../../components/icons/MonitorIcon';
import MoonIcon from '../../../../components/icons/MoonIcon';
import SunIcon from '../../../../components/icons/SunIcon';
import { useTheme } from '../../../../context/ThemeContext';
import type { ThemePreference } from '../../../../utils/theme';
import SectionCard from '../../students/profile/components/SectionCard';

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Light', Icon: SunIcon },
  { value: 'dark', label: 'Dark', Icon: MoonIcon },
  { value: 'system', label: 'System', Icon: MonitorIcon },
];

// Applies on click, with no Save button: it's a preference on this device,
// not data on the server. Real radio inputs, so arrow keys and screen
// readers work without extra code.
function AppearanceCard() {
  const { preference, setPreference } = useTheme();
  const name = useId();
  const hintId = useId();

  return (
    <SectionCard title="Appearance">
      <fieldset aria-describedby={hintId}>
        <legend className="text-sm font-semibold text-ink">Theme</legend>

        <div className="mt-2.5 grid max-w-[480px] grid-cols-3 gap-2.5">
          {OPTIONS.map(({ value, label, Icon }) => (
            <label
              key={value}
              className="
                flex cursor-pointer flex-col items-center gap-2
                rounded-xl border border-border bg-surface px-3 py-4
                text-sm font-semibold text-ink-secondary
                transition-colors
                hover:border-ink-muted/40 hover:text-ink
                has-[:checked]:border-primary has-[:checked]:bg-primary-tint has-[:checked]:text-primary
                has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary
              "
            >
              <input
                type="radio"
                name={name}
                value={value}
                checked={preference === value}
                onChange={() => setPreference(value)}
                className="sr-only"
              />
              <Icon className="h-5 w-5" />
              {label}
            </label>
          ))}
        </div>

        <p
          id={hintId}
          className="mt-2.5 text-[13px] text-ink-secondary"
        >
          Saved on this device. System follows your device’s light or dark setting.
        </p>
      </fieldset>
    </SectionCard>
  );
}

export default AppearanceCard;
