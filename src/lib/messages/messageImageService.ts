import { ensureSupabaseSession, getSupabase } from '../supabase';
import { isLocalTaskboardMode } from '../taskboard/taskService';
import { getAttachmentUrl } from '../taskboard/taskService';

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read image.'));
    reader.readAsDataURL(file);
  });
}

function extensionForMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/webp') return 'webp';
  return 'png';
}

function safeUsernameSegment(username: string): string {
  const cleaned = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return cleaned || 'user';
}

async function db() {
  await ensureSupabaseSession();
  return getSupabase();
}

export async function uploadMessageImage(
  file: File,
  username: string
): Promise<{ storagePath: string; previewUrl: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files can be pasted.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image is too large (max 6 MB).');
  }

  if (isLocalTaskboardMode()) {
    const dataUrl = await readFileAsDataUrl(file);
    return { storagePath: dataUrl, previewUrl: dataUrl };
  }

  const segment = safeUsernameSegment(username);
  const path = `messages/${segment}/${crypto.randomUUID()}.${extensionForMime(file.type)}`;

  const { error: uploadError } = await (await db())
    .storage.from('task-attachments')
    .upload(path, file, { upsert: false, contentType: file.type });

  if (uploadError) throw uploadError;

  const previewUrl = await getMessageImageUrl(path);
  return { storagePath: path, previewUrl };
}

export async function getMessageImageUrl(storagePath: string): Promise<string> {
  if (storagePath.startsWith('data:')) return storagePath;
  return getAttachmentUrl(storagePath);
}

/** Resolve persisted storage path from editor/feed img attributes (incl. signed preview URLs). */
export function messageImageStoragePathFromElement(img: Element): string | null {
  const dataPath = img.getAttribute('data-storage-path')?.trim();
  if (dataPath) return dataPath;

  const src = img.getAttribute('src')?.trim() ?? '';
  if (!src) return null;
  if (src.startsWith('data:image/')) return src;

  const signed = src.match(/task-attachments\/((?:messages\/)[^?"']+)/i);
  if (signed?.[1]) {
    try {
      return decodeURIComponent(signed[1]);
    } catch {
      return signed[1];
    }
  }

  return null;
}

export function messageImageFileNameFromPath(storagePath: string): string {
  const segment = storagePath.split('/').filter(Boolean).pop();
  if (segment && /\.\w{2,5}$/i.test(segment)) return segment;
  return 'message-image.png';
}

/** Download image (handles signed URLs via fetch). */
export async function downloadMessageImage(imageUrl: string, fileName: string): Promise<void> {
  if (imageUrl.startsWith('data:')) {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }

  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error('Could not download image.');
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
