import { getSupabase, ensureSupabaseSession } from '../supabase';
import {
  mergeLocalInstallationPatch,
  notifyInstallationsUpdated,
} from './localInstallationOverrides';
import { isPhotoFile } from './installationDocumentService';
import {
  getAttachmentUrl,
  prefetchAttachmentUrls,
  type AttachmentUrlTransform,
} from '../taskboard/taskService';
import { isSupabaseConfigured } from '../taskboard/config';
import { clampHeaderImageFocusY } from './installationService';
import { patchInstallationRow } from './installationDbPatch';
import type { InstallationRecord } from './types';

const MAX_HEADER_IMAGE_BYTES = 8 * 1024 * 1024;

export type InstallationHeaderImageVariant = 'card' | 'detail';

const HEADER_IMAGE_TRANSFORMS: Record<
  InstallationHeaderImageVariant,
  AttachmentUrlTransform | undefined
> = {
  /** Overview cards: smaller file, enough for ~400px-wide tiles @2x. */
  card: { width: 800, height: 520, resize: 'cover', quality: 80 },
  /** Original file from storage — no resize/crop (banner framing is CSS only). */
  detail: undefined,
};

function sanitizeStem(name: string) {
  const stem = name.replace(/\.[^.]+$/, '').trim() || 'header';
  return stem.replace(/[^\w.-]+/g, '-').slice(0, 80);
}

export async function getInstallationHeaderImageUrl(
  storagePath: string | null | undefined,
  variant: InstallationHeaderImageVariant = 'detail',
): Promise<string | null> {
  if (!storagePath) return null;
  if (storagePath.startsWith('data:')) return storagePath;

  if (variant === 'detail') {
    return getAttachmentUrl(storagePath);
  }

  const transform = HEADER_IMAGE_TRANSFORMS.card;
  try {
    return await getAttachmentUrl(storagePath, { transform });
  } catch {
    return getAttachmentUrl(storagePath);
  }
}

export async function updateInstallationHeaderImageFocusY(
  installationId: string,
  focusY: number,
): Promise<void> {
  const header_image_focus_y = clampHeaderImageFocusY(focusY);
  if (isSupabaseConfigured()) {
    await patchInstallationRow(installationId, { header_image_focus_y });
  }
  mergeLocalInstallationPatch(installationId, { header_image_focus_y });
  /* No global refresh — avoids banner/layout flicker; position is already live in the UI. */
}

export function prefetchInstallationHeaderImageUrls(
  storagePaths: Iterable<string | null | undefined>,
  variant: InstallationHeaderImageVariant = 'card',
): void {
  const transform = HEADER_IMAGE_TRANSFORMS[variant];
  prefetchAttachmentUrls(storagePaths, transform);
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
