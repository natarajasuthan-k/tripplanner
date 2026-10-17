import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from '../theme/ThemeProvider';

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'system', label: 'System theme', Icon: Monitor },
  { value: 'light', label: 'Light theme', Icon: Sun },
  { value: 'dark', label: 'Dark theme', Icon: Moon },
];

/** System / Light / Dark switch (frontend-spec §4, §8). */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={preference === value}
          aria-label={label}
          title={label}
          onClick={() => setPreference(value)}
          className={`rounded-md p-1.5 ${
            preference === value
              ? 'bg-teal-700 text-white dark:bg-teal-400 dark:text-slate-950'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
