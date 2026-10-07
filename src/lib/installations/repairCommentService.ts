import type { InstallationRepairComment } from './types';
import { ensureSupabaseSession, getSupabase } from '../supabase';
import { isSupabaseConfigured } from '../taskboard/config';

async function db() {
  await ensureSupabaseSession();
  return getSupabase();
}

function mapComment(row: Record<string, unknown>): InstallationRepairComment {
  return {
    id: String(row.id),
    repair_id: String(row.repair_id),
    author_username: String(row.author_username ?? ''),
    author_display_name: String(row.author_display_name ?? ''),
    body: String(row.body ?? ''),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

export async function fetchRepairComments(repairId: string): Promise<InstallationRepairComment[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await (await db())
    .from('installation_repair_comments')
    .select('*')
    .eq('repair_id', repairId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(mapComment);
}

export async function createRepairComment(
  repairId: string,
  body: string,
  author: { username: string; displayName: string },
): Promise<InstallationRepairComment> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Comment cannot be empty.');
  if (!author.username) throw new Error('You must be logged in to comment.');
  if (!isSupabaseConfigured()) {
    throw new Error('Comments require Supabase to be connected.');
  }

  const { data, error } = await (await db())
    .from('installation_repair_comments')
    .insert({
      repair_id: repairId,
      author_username: author.username,
      author_display_name: author.displayName || author.username,
      body: trimmed,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapComment(data as Record<string, unknown>);
}
