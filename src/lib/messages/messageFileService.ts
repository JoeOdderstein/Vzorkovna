import { ensureSupabaseSession, getSupabase } from '../supabase';
import { isLocalTaskboardMode } from '../taskboard/taskService';
import { getAttachmentUrl } from '../taskboard/taskService';

export const MAX_MESSAGE_FILE_BYTES = 25 * 1024 * 1024;

const BLOCKED_EXTENSIONS = new Set(['exe', 'bat', 'cmd', 'sh', 'msi', 'scr', 'com']);

function safeUsernameSegment(username: string): string {
  const cleaned = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return cleaned || 'user';
}

function safeFileBaseName(name: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, '_').trim();
  return base.slice(0, 120) || 'file';
}

function extensionFromFileName(name: string): string {
  const part = name.split('.').pop()?.toLowerCase().trim();
  if (!part || part.length > 8) return 'bin';
  if (BLOCKED_EXTENSIONS.has(part)) return 'bin';
  return part.replace(/[^a-z0-9]/g, '') || 'bin';
}

async function db() {
  await ensureSupabaseSession();
  return getSupabase();
}

export async function uploadMessageFile(
  file: File,
  username: string
): Promise<{ storagePath: string; fileName: string }> {
  if (file.size > MAX_MESSAGE_FILE_BYTES) {
    throw new Error('File is too large (max 25 MB).');
  }

  const ext = extensionFromFileName(file.name);
  if (BLOCKED_EXTENSIONS.has(ext)) {
    throw new Error('This file type is not allowed.');
  }

  if (isLocalTaskboardMode()) {
    throw new Error('File attachments require Supabase storage.');
  }

  const segment = safeUsernameSegment(username);
  const safeName = safeFileBaseName(file.name);
  const path = `messages/${segment}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await (await db())
    .storage.from('task-attachments')
    .upload(path, file, { upsert: false, contentType: file.type || undefined });

  if (uploadError) throw uploadError;

  return { storagePath: path, fileName: file.name };
}

export async function getMessageFileUrl(storagePath: string): Promise<string> {
  return getAttachmentUrl(storagePath);
}

export async function downloadMessageFile(storagePath: string, fileName: string): Promise<void> {
  const url = await getMessageFileUrl(storagePath);
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not download file.');
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function formatMessageFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
