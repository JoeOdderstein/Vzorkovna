import { getAdminUsername, isAdminUsername } from './auth.js';
import { getSupabaseAdmin } from './supabaseAdmin.js';

function messageAccessTableMissing(error) {
  const message = error?.message ?? '';
  return /message_access_members|relation|does not exist/i.test(message);
}

function normalizeUsername(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

/** When `active` is false, everyone may be treated as having Messages access (migration not applied). */
export async function loadMessageAreaAccessAllowSet() {
  const allowed = new Set([normalizeUsername(getAdminUsername())]);
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { active: false, allowed };
  }

  const { data, error } = await supabase.from('message_access_members').select('username');

  if (error) {
    if (messageAccessTableMissing(error)) {
      return { active: false, allowed };
    }
    throw error;
  }

  for (const row of data ?? []) {
    const username = normalizeUsername(row.username);
    if (username) allowed.add(username);
  }

  return { active: true, allowed };
}

export function usernameHasMessageAreaAccess(username, allowSet) {
  const key = normalizeUsername(username);
  if (!key) return false;
  if (isAdminUsername(username)) return true;
  if (!allowSet?.active) return true;
  return allowSet.allowed.has(key);
}
