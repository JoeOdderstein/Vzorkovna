import type { TaskPhoto } from './types';
import { ensureSupabaseSession, getSupabase } from '../supabase';
import { getAttachmentUrl, isLocalTaskboardMode, uploadAttachment } from './taskService';
import { localStore } from './localStore';
import { isImageAttachment } from './attachmentUtils';

async function db() {
  await ensureSupabaseSession();
  return getSupabase();
}

function mapPhoto(row: Record<string, unknown>): TaskPhoto {
  return {
    id: String(row.id),
    task_id: String(row.task_id),
    storage_path: String(row.storage_path ?? ''),
    file_name: String(row.file_name ?? ''),
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at ?? ''),
  };
}

export async function fetchTaskPhotos(taskId: string): Promise<TaskPhoto[]> {
  if (isLocalTaskboardMode()) {
    return localStore.getTaskPhotos(taskId);
  }

  const { data, error } = await (await db())
    .from('task_photos')
    .select('*')
    .eq('task_id', taskId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    if (/task_photos|relation|does not exist/i.test(error.message)) {
      return fetchLegacyTaskPhoto(taskId);
    }
    throw error;
  }

  const photos = ((data ?? []) as Record<string, unknown>[]).map(mapPhoto);
  if (photos.length > 0) return photos;

  return fetchLegacyTaskPhoto(taskId);
}

async function fetchLegacyTaskPhoto(taskId: string): Promise<TaskPhoto[]> {
  const { data: task, error } = await (await db())
    .from('tasks')
    .select('attachment_path, attachment_name')
    .eq('id', taskId)
    .maybeSingle();

  if (error || !task?.attachment_path) return [];
  if (!isImageAttachment(task.attachment_name, task.attachment_path)) return [];

  return [
    {
      id: `legacy-${taskId}`,
      task_id: taskId,
      storage_path: String(task.attachment_path),
      file_name: String(task.attachment_name ?? 'photo'),
      sort_order: 0,
      created_at: '',
    },
  ];
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export async function getTaskPhotoUrl(storagePath: string): Promise<string> {
  if (storagePath.startsWith('data:')) return storagePath;
  return getAttachmentUrl(storagePath);
}

export async function addTaskPhoto(taskId: string, file: File): Promise<TaskPhoto> {
  if (isLocalTaskboardMode()) {
    const dataUrl = await readFileAsDataUrl(file);
    return localStore.addTaskPhoto(taskId, file, dataUrl);
  }

  const { path, name } = await uploadAttachment(file, taskId);
  const existing = await fetchTaskPhotos(taskId);
  const sort_order =
    existing.reduce((max, photo) => Math.max(max, photo.sort_order), -1) + 1;

  const { data, error } = await (await db())
    .from('task_photos')
    .insert({
      task_id: taskId,
      storage_path: path,
      file_name: name,
      sort_order,
    })
    .select('*')
    .single();

  if (error) throw error;

  const photo = mapPhoto(data as Record<string, unknown>);

  if (existing.length === 1 && existing[0].id.startsWith('legacy-')) {
    await (await db())
      .from('tasks')
      .update({ attachment_path: null, attachment_name: null })
      .eq('id', taskId);
  }

  return photo;
}

export async function deleteTaskPhoto(photoId: string, taskId: string): Promise<void> {
  if (isLocalTaskboardMode()) {
    localStore.deleteTaskPhoto(photoId);
    return;
  }

  if (photoId.startsWith('legacy-')) {
    await (await db())
      .from('tasks')
      .update({ attachment_path: null, attachment_name: null })
      .eq('id', taskId);
    return;
  }

  const { data: row, error: fetchError } = await (await db())
    .from('task_photos')
    .select('storage_path')
    .eq('id', photoId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const { error: deleteError } = await (await db()).from('task_photos').delete().eq('id', photoId);

  if (deleteError) throw deleteError;

  if (row?.storage_path) {
    await (await db()).storage.from('task-attachments').remove([String(row.storage_path)]);
  }
}
