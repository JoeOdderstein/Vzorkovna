import { Moon, Sun } from 'lucide-react';
import { useTaskboardTheme } from '../../context/TaskboardThemeContext';
import TbIconTooltip from './TbIconTooltip';

export default function TaskboardThemeToggle() {
  const { theme, toggleTheme } = useTaskboardTheme();
  const isDark = theme === 'dark';
  const label = isDark ? 'Light mode' : 'Dark mode';

  return (
    <TbIconTooltip label={label}>
      <button
        type="button"
        onClick={toggleTheme}
        className="tb-theme-toggle inline-flex items-center justify-center rounded-full border transition-colors duration-300"
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {isDark ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
      </button>
    </TbIconTooltip>
  );
}
