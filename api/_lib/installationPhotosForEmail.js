import { getSupabaseAdmin } from './supabaseAdmin.js';

const BUCKET = 'task-attachments';
const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7;

export async function getInstallationDocumentSignedUrlsForEmail(storagePaths) {
  if (!Array.isArray(storagePaths) || storagePaths.length === 0) return [];

  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const urls = [];
  for (const path of storagePaths.slice(0, 6)) {
    if (!path || path.startsWith('data:')) continue;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SEC);
    if (!error && data?.signedUrl) {
      urls.push(data.signedUrl);
    }
  }
  return urls;
}
