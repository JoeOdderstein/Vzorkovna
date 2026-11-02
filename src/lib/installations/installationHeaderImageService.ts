import { isSupabaseConfigured } from '../taskboard/config';
import { getSupabase, ensureSupabaseSession } from '../supabase';
import { notifyInstallationsUpdated } from './localInstallationOverrides';
import { isPhotoFile } from './installationDocumentService';
import { getAttachmentUrl } from '../taskboard/taskService';
import { patchInstallationRow } from './installationDbPatch';
import type { InstallationRecord } from './types';

const MAX_HEADER_IMAGE_BYTES = 8 * 1024 * 1024;

function sanitizeStem(name: string) {
  const stem = name.replace(/\.[^.]+$/, '').trim() || 'header';
  return stem.replace(/[^\w.-]+/g, '-').slice(0, 80);
}

export async function getInstallationHeaderImageUrl(
  storagePath: string | null | undefined,
): Promise<string | null> {
  if (!storagePath) return null;
  if (storagePath.startsWith('data:')) return storagePath;
  return getAttachmentUrl(storagePath);
}

export async function uploadInstallationHeaderImage(
  installationId: string,
  file: File,
  previousPath: string | null,
): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error('Upload requires Supabase to be connected.');
  }
  if (!isPhotoFile(file)) {
    throw new Error('Please choose an image file (JPEG, PNG, or WebP).');
  }
  if (file.size > MAX_HEADER_IMAGE_BYTES) {
    throw new Error('Header image must be 8 MB or smaller.');
  }

  const stem = sanitizeStem(file.name);
  const ext = file.name.match(/\.(\w+)$/)?.[1]?.toLowerCase() || 'jpg';
  const path = `installations/${installationId}/header/${Date.now()}-${stem}.${ext}`;
  const contentType = file.type || 'image/jpeg';

  await ensureSupabaseSession();
  const supabase = getSupabase();
  const { error: uploadError } = await supabase.storage
    .from('task-attachments')
    .upload(path, file, { upsert: false, contentType });

  if (uploadError) throw uploadError;

  try {
    await patchInstallationRow(installationId, { header_image_path: path });
  } catch (err) {
    await supabase.storage.from('task-attachments').remove([path]);
    throw err;
  }

  if (previousPath && !previousPath.startsWith('data:')) {
    await supabase.storage.from('task-attachments').remove([previousPath]).catch(() => {});
  }

  notifyInstallationsUpdated();
  return path;
}

export async function clearInstallationHeaderImage(
  installation: Pick<InstallationRecord, 'id' | 'header_image_path'>,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Removing the header image requires Supabase.');
  }

  await patchInstallationRow(installation.id, { header_image_path: null });

  const path = installation.header_image_path;
  if (path && !path.startsWith('data:')) {
    await ensureSupabaseSession();
    const supabase = getSupabase();
    await supabase.storage.from('task-attachments').remove([path]).catch(() => {});
  }

  notifyInstallationsUpdated();
}
