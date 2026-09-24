import type { TaskComment } from './types';
import { ensureSupabaseSession, getSupabase } from '../supabase';
import { isLocalTaskboardMode } from './taskService';
import { localStore } from './localStore';

async function db() {
  await ensureSupabaseSession();
  return getSupabase();
}

function mapComment(row: Record<string, unknown>): TaskComment {
  return {
    id: String(row.id),
    task_id: String(row.task_id),
    author_username: String(row.author_username ?? ''),
    author_display_name: String(row.author_display_name ?? ''),
    body: String(row.body ?? ''),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

export async function fetchTaskComments(taskId: string): Promise<TaskComment[]> {
  if (isLocalTaskboardMode()) {
    return localStore.getTaskComments(taskId);
  }

  const { data, error } = await (await db())
    .from('task_comments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(mapComment);
}

export async function createTaskComment(
  taskId: string,
  body: string,
  author: { username: string; displayName: string }
): Promise<TaskComment> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Comment cannot be empty.');
  if (!author.username) throw new Error('You must be logged in to comment.');

  if (isLocalTaskboardMode()) {
    return localStore.createTaskComment(taskId, trimmed, author);
  }

  const { data, error } = await (await db())
    .from('task_comments')
    .insert({
      task_id: taskId,
      author_username: author.username,
      author_display_name: author.displayName || author.username,
      body: trimmed,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapComment(data as Record<string, unknown>);
}

export async function updateTaskComment(
  commentId: string,
  body: string,
  authorUsername: string | null
): Promise<TaskComment> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Comment cannot be empty.');
  if (!authorUsername) throw new Error('You must be logged in to edit a comment.');

  if (isLocalTaskboardMode()) {
    return localStore.updateTaskComment(commentId, trimmed, authorUsername);
  }

  const { data, error } = await (await db())
    .from('task_comments')
    .update({ body: trimmed })
    .eq('id', commentId)
    .select('*')
    .single();

  if (error) throw error;
  return mapComment(data as Record<string, unknown>);
}

export async function deleteTaskComment(
  commentId: string,
  authorUsername: string | null
): Promise<void> {
  if (!authorUsername) throw new Error('You must be logged in to delete a comment.');

  if (isLocalTaskboardMode()) {
    localStore.deleteTaskComment(commentId, authorUsername);
    return;
  }

  const { error } = await (await db()).from('task_comments').delete().eq('id', commentId);

  if (error) throw error;
}

export function subscribeToTaskComments(taskId: string, onChange: () => void) {
  if (isLocalTaskboardMode()) {
    return localStore.subscribeToTaskComments(taskId, onChange);
  }

  let cancelled = false;
  let cleanup: (() => void) | undefined;

  ensureSupabaseSession().then(() => {
    if (cancelled) return;
    const channel = getSupabase()
      .channel(`task_comments:${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`,
        },
        () => onChange()
      )
      .subscribe();

    cleanup = () => {
      getSupabase().removeChannel(channel);
    };
  });

  return () => {
    cancelled = true;
    cleanup?.();
  };
}
