import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
let sessionToken: string | null = null;

export function getSupabase() {
  if (!client) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }
    client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      accessToken: async () => sessionToken ?? '',
    });
  }
  return client;
}

export async function setSupabaseSession(accessToken: string) {
  sessionToken = accessToken;
  const supabase = getSupabase();
  try {
    await supabase.realtime.setAuth(accessToken);
  } catch {
    // Realtime auth is optional — REST queries still work
  }
}

export async function clearSupabaseSession() {
  sessionToken = null;
  const supabase = getSupabase();
  await supabase.realtime.setAuth(null);
  await supabase.auth.signOut();
}

/** Ensure the Supabase client has the taskboard JWT before RLS-protected queries. */
export async function ensureSupabaseSession() {
  if (sessionToken) return;

  const res = await fetch('/api/auth/session');
  if (!res.ok) {
    throw new Error('Session expired. Please log in again.');
  }

  const data = await res.json();
  if (!data.accessToken) {
    throw new Error('No session token. Please log in again.');
  }

  await setSupabaseSession(data.accessToken);
}
