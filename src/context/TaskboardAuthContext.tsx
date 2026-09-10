import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured } from '../lib/taskboard/config';
import { clearSupabaseSession, setSupabaseSession } from '../lib/supabase';

interface AuthContextValue {
  authenticated: boolean;
  loading: boolean;
  sessionReady: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const TaskboardAuthContext = createContext<AuthContextValue | null>(null);

export function TaskboardAuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const authOpRef = useRef(0);

  const applySession = useCallback(async (accessToken: string, sessionUsername?: string | null) => {
    authOpRef.current += 1;

    if (isSupabaseConfigured()) {
      await setSupabaseSession(accessToken);
    }

    setAuthenticated(true);
    setSessionReady(true);
    setUsername(sessionUsername ?? null);
    setLoading(false);
  }, []);

  const checkSession = useCallback(async () => {
    const opId = authOpRef.current;

    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      if (opId !== authOpRef.current) return;

      if (!res.ok) {
        setAuthenticated(false);
        setSessionReady(false);
        setUsername(null);
        if (isSupabaseConfigured()) await clearSupabaseSession();
        return;
      }

      const data = await res.json();
      if (opId !== authOpRef.current) return;

      if (data.authenticated && data.accessToken) {
        if (isSupabaseConfigured()) {
          await setSupabaseSession(data.accessToken);
        }
        if (opId !== authOpRef.current) return;
        setAuthenticated(true);
        setSessionReady(true);
        setUsername(typeof data.username === 'string' ? data.username : null);
      } else {
        setAuthenticated(false);
        setSessionReady(false);
        setUsername(null);
      }
    } catch {
      if (opId !== authOpRef.current) return;
      setAuthenticated(false);
      setSessionReady(false);
      setUsername(null);
    } finally {
      if (opId === authOpRef.current) setLoading(false);
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
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          return (data.error as string) ?? 'Login failed';
        }

        if (data.accessToken) {
          await applySession(
            data.accessToken,
            typeof data.username === 'string' ? data.username : username
          );
        }
        return null;
      } catch {
        return 'Could not reach the login server. Restart the dev server and try again.';
      }
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    authOpRef.current += 1;
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      if (isSupabaseConfigured()) {
        try {
          await clearSupabaseSession();
        } catch {
          // Supabase cleanup is best-effort — local session still clears below
        }
      }
    } finally {
      setAuthenticated(false);
      setSessionReady(false);
      setUsername(null);
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({ authenticated, loading, sessionReady, username, login, logout }),
    [authenticated, loading, sessionReady, username, login, logout]
  );

  return <TaskboardAuthContext.Provider value={value}>{children}</TaskboardAuthContext.Provider>;
}

export function useTaskboardAuth() {
  const ctx = useContext(TaskboardAuthContext);
  if (!ctx) throw new Error('useTaskboardAuth must be used within TaskboardAuthProvider');
  return ctx;
}
