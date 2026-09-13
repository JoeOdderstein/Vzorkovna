import { createContext, useCallback, useContext, useMemo } from 'react';
import { useUserProfile } from './UserProfileContext';
import {
  cacheThemeForUser,
  getCachedThemeForUser,
} from '../lib/taskboard/userProfileService';
import { useTaskboardAuth } from './TaskboardAuthContext';

export type TaskboardTheme = 'dark' | 'light';

interface TaskboardThemeContextValue {
  theme: TaskboardTheme;
  setTheme: (theme: TaskboardTheme) => void;
  toggleTheme: () => void;
}

const TaskboardThemeContext = createContext<TaskboardThemeContextValue | null>(null);

export function TaskboardThemeProvider({ children }: { children: React.ReactNode }) {
  const { username } = useTaskboardAuth();
  const { profile, updateProfile } = useUserProfile();

  const theme: TaskboardTheme =
    profile?.theme ?? (username ? getCachedThemeForUser(username) : null) ?? 'light';

  const setTheme = useCallback(
    (next: TaskboardTheme) => {
      if (username) cacheThemeForUser(username, next);
      void updateProfile({ theme: next }).catch(() => {});
    },
    [username, updateProfile]
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return (
    <TaskboardThemeContext.Provider value={value}>{children}</TaskboardThemeContext.Provider>
  );
}

export function useTaskboardTheme() {
  const ctx = useContext(TaskboardThemeContext);
  if (!ctx) throw new Error('useTaskboardTheme must be used within TaskboardThemeProvider');
  return ctx;
}
