import { Moon, Sun } from 'lucide-react';
import { useTaskboardTheme } from '../../context/TaskboardThemeContext';

export default function TaskboardThemeToggle() {
  const { theme, toggleTheme } = useTaskboardTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="tb-theme-toggle inline-flex items-center justify-center rounded-full border transition-colors duration-300"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
    </button>
  );
}
