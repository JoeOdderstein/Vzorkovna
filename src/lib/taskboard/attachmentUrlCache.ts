import { ensureSupabaseSession, getSupabase } from '../supabase';
import { isSupabaseConfigured } from './config';

export type AttachmentUrlTransform = {
  width?: number;
  height?: number;
  resize?: 'cover' | 'contain' | 'fill';
  quality?: number;
  format?: 'origin' | 'webp';
};

const SIGNED_URL_TTL_SEC = 3600;
/** Refresh cached URLs before Supabase expiry. */
const CACHE_TTL_MS = (SIGNED_URL_TTL_SEC - 300) * 1000;

type CacheEntry = {
  url: string;
  expiresAt: number;
};

const urlCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string>>();

function cacheKey(path: string, transform?: AttachmentUrlTransform): string {
  if (!transform || Object.keys(transform).length === 0) return path;
  return `${path}\0${JSON.stringify(transform)}`;
}

export async function resolveAttachmentUrl(
  path: string,
  transform?: AttachmentUrlTransform,
): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error('Attachments require Supabase.');
  }

  const key = cacheKey(path, transform);
  const cached = urlCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  let pending = inflight.get(key);
  if (!pending) {
    pending = (async () => {
      await ensureSupabaseSession();
      const supabase = getSupabase();
      const { data, error } = await supabase.storage
        .from('task-attachments')
        .createSignedUrl(path, SIGNED_URL_TTL_SEC, {
          ...(transform && Object.keys(transform).length > 0 ? { transform } : {}),
        });

      if (error) throw error;
      const url = data.signedUrl;
      urlCache.set(key, { url, expiresAt: Date.now() + CACHE_TTL_MS });
      inflight.delete(key);
      return url;
    })();
    inflight.set(key, pending);
  }

  try {
    return await pending;
  } catch (err) {
    inflight.delete(key);
    throw err;
  }
}

/** Warm the cache (e.g. project overview cards). Failures are ignored per path. */
export function prefetchAttachmentUrls(
  paths: Iterable<string | null | undefined>,
  transform?: AttachmentUrlTransform,
): void {
  const seen = new Set<string>();
  for (const raw of paths) {
    if (!raw || raw.startsWith('data:') || seen.has(raw)) continue;
    seen.add(raw);
    void resolveAttachmentUrl(raw, transform).catch(() => {});
  }
}
