/** Signed URL lifetime for images embedded in notification emails (7 days). */
const EMAIL_PHOTO_TTL_SEC = 60 * 60 * 24 * 7;

export const MAX_EMAIL_PHOTOS = 4;

function isImageStoragePath(path) {
  const base = String(path ?? '').split('?')[0];
  return /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(base);
}

/**
 * Load task photo paths and return signed HTTPS URLs for use in HTML emails.
 */
export async function getTaskPhotoSignedUrlsForEmail(supabase, taskId) {
  if (!supabase || !taskId) {
    return { urls: [], totalCount: 0 };
  }

  let paths = [];

  const { data: rows, error: photosError } = await supabase
    .from('task_photos')
    .select('storage_path, sort_order, created_at')
    .eq('task_id', taskId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (!photosError && Array.isArray(rows) && rows.length > 0) {
    paths = rows.map((row) => row.storage_path).filter(Boolean);
  } else {
    const { data: task } = await supabase
      .from('tasks')
      .select('attachment_path')
      .eq('id', taskId)
      .maybeSingle();

    if (task?.attachment_path && isImageStoragePath(task.attachment_path)) {
      paths = [task.attachment_path];
    }
  }

  const totalCount = paths.length;
  if (totalCount === 0) {
    return { urls: [], totalCount: 0 };
  }

  const urls = [];
  for (const path of paths.slice(0, MAX_EMAIL_PHOTOS)) {
    const { data, error } = await supabase.storage
      .from('task-attachments')
      .createSignedUrl(path, EMAIL_PHOTO_TTL_SEC);

    if (error) {
      console.error(`Email photo signed URL failed for ${path}:`, error.message);
      continue;
    }
    if (data?.signedUrl) urls.push(data.signedUrl);
  }

  return { urls, totalCount };
}
