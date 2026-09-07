import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from '../lib/taskboard/config';
import { clearSupabaseSession, setSupabaseSession } from '../lib/supabase';

interface AuthContextValue {
  authenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const TaskboardAuthContext = createContext<AuthContextValue | null>(null);

export function TaskboardAuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback(async (accessToken: string) => {
    if (isSupabaseConfigured()) {
      await setSupabaseSession(accessToken);
    }
    setAuthenticated(true);
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session');
      if (!res.ok) {
        setAuthenticated(false);
        if (isSupabaseConfigured()) await clearSupabaseSession();
        return;
      }
      const data = await res.json();
      if (data.authenticated && data.accessToken) {
        if (isSupabaseConfigured()) {
          await setSupabaseSession(data.accessToken);
        }
        setAuthenticated(true);
      } else {
        setAuthenticated(false);
      }
    } catch {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = useCallback(
    async (username: string, password: string) => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          return (data.error as string) ?? 'Login failed';
        }

        if (data.accessToken) {
          await applySession(data.accessToken);
        }
        return null;
      } catch {
        return 'Could not reach the login server. Restart the dev server and try again.';
      }
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    if (isSupabaseConfigured()) await clearSupabaseSession();
    setAuthenticated(false);
  }, []);

  const value = useMemo(
    () => ({ authenticated, loading, login, logout }),
    [authenticated, loading, login, logout]
  );

  return <TaskboardAuthContext.Provider value={value}>{children}</TaskboardAuthContext.Provider>;
}

export function useTaskboardAuth() {
  const ctx = useContext(TaskboardAuthContext);
  if (!ctx) throw new Error('useTaskboardAuth must be used within TaskboardAuthProvider');
  return ctx;
}
