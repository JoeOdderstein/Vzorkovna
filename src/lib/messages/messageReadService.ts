import { ensureSupabaseSession, getSupabase } from '../supabase';
import { isLocalTaskboardMode } from '../taskboard/taskService';

const LOCAL_READS_KEY = 'team_message_reads_v1';

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function loadLocalReadIds(username: string): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_READS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    const key = normalizeUsername(username);
    const ids = parsed[key];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

function saveLocalReadIds(username: string, ids: Set<string>) {
  const key = normalizeUsername(username);
  try {
    const raw = localStorage.getItem(LOCAL_READS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    parsed[key] = [...ids];
    localStorage.setItem(LOCAL_READS_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

async function db() {
  await ensureSupabaseSession();
  return getSupabase();
}

export async function fetchTeamMessageReadIds(username: string): Promise<Set<string>> {
  const actor = normalizeUsername(username);
  if (!actor) return new Set();

  if (isLocalTaskboardMode()) {
    return loadLocalReadIds(actor);
  }

  const { data, error } = await (await db())
    .from('team_message_reads')
    .select('message_id')
    .eq('username', actor);

  if (error) {
    if (/team_message_reads|relation|does not exist/i.test(error.message)) {
      return new Set();
    }
    throw error;
  }

  return new Set((data ?? []).map((row) => String(row.message_id)));
}

export async function setTeamMessageRead(
  messageId: string,
  username: string,
  read: boolean
): Promise<void> {
  const actor = normalizeUsername(username);
  if (!actor || !messageId.trim()) return;

  if (isLocalTaskboardMode()) {
    const ids = loadLocalReadIds(actor);
    if (read) ids.add(messageId);
    else ids.delete(messageId);
    saveLocalReadIds(actor, ids);
    return;
  }

  if (read) {
    const { error } = await (await db()).from('team_message_reads').upsert(
      { message_id: messageId, username: actor },
      { onConflict: 'message_id,username' }
    );
    if (error) {
      if (/team_message_reads|relation|does not exist/i.test(error.message)) {
        throw new Error(
          'Read tracking needs a database update. Run supabase/migrations/034_team_message_reads.sql in Supabase.'
        );
      }
      throw error;
    }
    return;
  }

  const { error } = await (await db())
    .from('team_message_reads')
    .delete()
    .eq('message_id', messageId)
    .eq('username', actor);

  if (error) {
    if (/team_message_reads|relation|does not exist/i.test(error.message)) {
      throw new Error(
        'Read tracking needs a database update. Run supabase/migrations/034_team_message_reads.sql in Supabase.'
      );
    }
    throw error;
  }
}
