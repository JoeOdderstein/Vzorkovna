import { ensureSupabaseSession, getSupabase } from '../supabase';
import { isLocalTaskboardMode } from './taskService';
import { localStore } from './localStore';
import { defaultBoardNameForUsername } from './boardNameUtils';
import { getErrorMessage } from './profileErrors';
import type { UserProfile, UserProfileTheme, UserProfileUpdate } from './types';

const THEME_STORAGE_PREFIX = 'taskboard-theme';
const LEGACY_THEME_STORAGE_KEY = 'taskboard-theme';

async function db() {
  await ensureSupabaseSession();
  return getSupabase();
}

function mapUserProfile(row: Record<string, unknown>): UserProfile {
  return row as UserProfile;
}

export function getCachedThemeForUser(username: string): UserProfileTheme | null {
  try {
    const key = `${THEME_STORAGE_PREFIX}:${username}`;
    let stored = localStorage.getItem(key);

    if (!stored) {
      const legacy = localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
      if (legacy === 'light' || legacy === 'dark') {
        localStorage.setItem(key, legacy);
        stored = legacy;
      }
    }

    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // ignore
  }

  return null;
}

export function cacheThemeForUser(username: string, theme: UserProfileTheme) {
  try {
    localStorage.setItem(`${THEME_STORAGE_PREFIX}:${username}`, theme);
  } catch {
    // ignore
  }
}

function defaultProfile(username: string): UserProfile {
  return {
    username,
    board_name: defaultBoardNameForUsername(username),
    email: null,
    theme: getCachedThemeForUser(username) ?? 'light',
    notify_on_assign: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function formatProfileError(error: { message?: string; code?: string }) {
  const message = error.message ?? '';
  if (/user_profiles|relation|column/i.test(message)) {
    return 'User profiles are not set up yet. Run supabase/migrations/009_user_profiles.sql and 010_user_profile_board_name.sql in Supabase SQL Editor.';
  }
  if (error.code === '23505' || /board_name|unique|duplicate/i.test(message)) {
    return 'That taskboard name is already linked to another account.';
  }
  if (error.code === 'PGRST116' || /0 rows/i.test(message)) {
    return 'Could not find your profile row. Refresh the page and try again.';
  }
  if (message.trim()) return message;
  return null;
}

function resolveBoardName(username: string, existing: UserProfile | null, override?: string | null) {
  const locked = defaultBoardNameForUsername(username);
  if (locked) return locked;

  const trimmed = override?.trim();
  if (trimmed) return trimmed;

  return existing?.board_name ?? null;
}

function buildProfileRow(
  username: string,
  existing: UserProfile | null,
  updates: UserProfileUpdate
): UserProfile {
  const defaults = defaultProfile(username);
  const board_name = resolveBoardName(
    username,
    existing,
    updates.board_name !== undefined ? updates.board_name : existing?.board_name
  );

  if (!board_name) {
    throw new Error('This account does not have a taskboard name configured.');
  }

  return {
    username,
    board_name,
    email: updates.email !== undefined ? updates.email : (existing?.email ?? defaults.email),
    theme: updates.theme ?? existing?.theme ?? defaults.theme,
    notify_on_assign:
      updates.notify_on_assign ?? existing?.notify_on_assign ?? defaults.notify_on_assign,
    created_at: existing?.created_at ?? defaults.created_at,
    updated_at: new Date().toISOString(),
  };
}

async function ensureBoardName(username: string, profile: UserProfile): Promise<UserProfile> {
  if (profile.board_name) return profile;

  const board_name = defaultBoardNameForUsername(username);
  if (!board_name) return profile;

  return updateUserProfile(username, { board_name });
}

export async function isUserProfilesReady() {
  if (isLocalTaskboardMode()) return true;

  const { error } = await (await db()).from('user_profiles').select('board_name').limit(1);
  return !error;
}

export async function fetchUserProfile(username: string): Promise<UserProfile | null> {
  if (isLocalTaskboardMode()) return localStore.getUserProfile(username);

  const { data, error } = await (await db())
    .from('user_profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  if (error) {
    if (/user_profiles|relation|column/i.test(error.message)) return null;
    throw error;
  }

  return data ? mapUserProfile(data as Record<string, unknown>) : null;
}

export async function fetchOrCreateUserProfile(username: string): Promise<UserProfile> {
  const existing = await fetchUserProfile(username);
  if (existing) {
    cacheThemeForUser(username, existing.theme);
    return ensureBoardName(username, existing);
  }

  const profile = defaultProfile(username);

  if (isLocalTaskboardMode()) {
    const created = localStore.upsertUserProfile(profile);
    cacheThemeForUser(username, created.theme);
    return created;
  }

  const { data, error } = await (await db())
    .from('user_profiles')
    .upsert(
      {
        username: profile.username,
        board_name: profile.board_name,
        email: profile.email,
        theme: profile.theme,
        notify_on_assign: profile.notify_on_assign,
      },
      { onConflict: 'username' }
    )
    .select('*')
    .single();

  if (error) {
    const message = formatProfileError(error);
    throw new Error(message ?? getErrorMessage(error, 'Could not create profile.'));
  }

  const created = mapUserProfile(data as Record<string, unknown>);
  cacheThemeForUser(username, created.theme);
  return created;
}

export async function updateUserProfile(
  username: string,
  updates: UserProfileUpdate
): Promise<UserProfile> {
  if (updates.theme) {
    cacheThemeForUser(username, updates.theme);
  }

  const existing = await fetchUserProfile(username);
  const row = buildProfileRow(username, existing, updates);

  if (isLocalTaskboardMode()) {
    const taken = localStore.listUserProfiles().some(
      (profile) => profile.username !== username && profile.board_name === row.board_name
    );
    if (taken) {
      throw new Error('That taskboard name is already linked to another account.');
    }
    return localStore.upsertUserProfile(row);
  }

  const { data, error } = await (await db())
    .from('user_profiles')
    .upsert(
      {
        username: row.username,
        board_name: row.board_name,
        email: row.email,
        theme: row.theme,
        notify_on_assign: row.notify_on_assign,
      },
      { onConflict: 'username' }
    )
    .select('*')
    .single();

  if (error) {
    const message = formatProfileError(error);
    throw new Error(message ?? getErrorMessage(error, 'Could not save profile.'));
  }

  return mapUserProfile(data as Record<string, unknown>);
}
