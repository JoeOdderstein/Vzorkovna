import { createContext, useContext, useMemo, useState } from 'react';

export type TaskboardTheme = 'dark' | 'light';

const STORAGE_KEY = 'taskboard-theme';

interface TaskboardThemeContextValue {
  theme: TaskboardTheme;
  setTheme: (theme: TaskboardTheme) => void;
  toggleTheme: () => void;
}

const TaskboardThemeContext = createContext<TaskboardThemeContextValue | null>(null);

function getInitialTheme(): TaskboardTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // ignore
  }
  return 'light';
}

export function TaskboardThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<TaskboardTheme>(getInitialTheme);

  const setTheme = (next: TaskboardTheme) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme]);

  return (
    <TaskboardThemeContext.Provider value={value}>{children}</TaskboardThemeContext.Provider>
  );
}

export function useTaskboardTheme() {
  const ctx = useContext(TaskboardThemeContext);
  if (!ctx) throw new Error('useTaskboardTheme must be used within TaskboardThemeProvider');
  return ctx;
}
