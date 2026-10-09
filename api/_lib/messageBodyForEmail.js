/** Signed URL lifetime for images/files embedded in team message emails (7 days). */
const EMAIL_ASSET_TTL_SEC = 60 * 60 * 24 * 7;

const HTML_BODY_PATTERN =
  /<\/?(?:p|br|div|span|strong|b|em|i|u|ul|ol|li|h[1-6]|font|img|a)\b/i;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHref(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function isLikelyHtmlMessageBody(body) {
  return HTML_BODY_PATTERN.test(String(body ?? '').trim());
}

function readAttr(tag, name) {
  const re = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i');
  const match = re.exec(tag);
  return match ? match[2] : null;
}

function storagePathFromImgTag(tag) {
  const dataPath = readAttr(tag, 'data-storage-path')?.trim();
  if (dataPath) return dataPath;

  const src = readAttr(tag, 'src')?.trim() ?? '';
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

async function signedStorageUrl(supabase, storagePath) {
  if (!storagePath) return null;
  if (storagePath.startsWith('data:')) return storagePath;

  const { data, error } = await supabase.storage
    .from('task-attachments')
    .createSignedUrl(storagePath, EMAIL_ASSET_TTL_SEC);

  if (error) {
    console.error('Message email signed URL failed:', storagePath, error.message);
    return null;
  }

  return data?.signedUrl ?? null;
}

async function replaceAsync(str, regex, replacer) {
  const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
  let out = '';
  let lastIndex = 0;
  let match;
  while ((match = re.exec(str)) !== null) {
    out += str.slice(lastIndex, match.index);
    out += await replacer(match[0], match);
    lastIndex = match.index + match[0].length;
  }
  out += str.slice(lastIndex);
  return out;
}

function stripUnsafeHtml(html) {
  let safe = String(html ?? '');
  safe = safe.replace(/<script[\s\S]*?<\/script>/gi, '');
  safe = safe.replace(/<style[\s\S]*?<\/style>/gi, '');
  safe = safe.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  safe = safe.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '');
  safe = safe.replace(/href\s*=\s*["']?\s*javascript:[^"'>\s]*/gi, 'href="#"');
  return safe;
}

function unwrapMessageImageBlocks(html) {
  return html.replace(
    /<span[^>]*class=["'][^"']*message-image-block[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi,
    '$1'
  );
}

function linkInnerText(tag) {
  const match = /<a\b[^>]*>([\s\S]*?)<\/a>/i.exec(tag);
  if (!match) return 'Attachment';
  return match[1].replace(/<[^>]+>/g, '').trim() || 'Attachment';
}

/**
 * Build email-safe HTML for a team message body (plain or rich text, with signed asset URLs).
 */
export async function buildMessageBodyHtmlForEmail(supabase, rawBody) {
  const trimmed = String(rawBody ?? '').trim();
  if (!trimmed) {
    return '<p style="margin:0;color:#888;font-size:14px;">(No message text)</p>';
  }

  if (!isLikelyHtmlMessageBody(trimmed)) {
    return `<div style="margin:0;white-space:pre-wrap;font-size:15px;line-height:1.55;color:#111;">${escapeHtml(trimmed)}</div>`;
  }

  let html = stripUnsafeHtml(unwrapMessageImageBlocks(trimmed));

  html = await replaceAsync(html, /<img\b[^>]*\/?>/gi, async (tag) => {
    const path = storagePathFromImgTag(tag);
    if (!path) return '';
    const url = await signedStorageUrl(supabase, path);
    if (!url) {
      return '<span style="color:#888;font-size:13px;">[Image unavailable]</span>';
    }
    return `<img src="${escapeHref(url)}" alt="" width="320" style="display:block;max-width:100%;height:auto;max-height:240px;object-fit:contain;border-radius:6px;border:1px solid #e5e5e5;margin:12px 0;" />`;
  });

  html = await replaceAsync(
    html,
    /<a\b[^>]*class=["'][^"']*message-file-attachment[^"']*["'][^>]*>[\s\S]*?<\/a>/gi,
    async (tag) => {
      const path = readAttr(tag, 'data-storage-path')?.trim();
      const name = readAttr(tag, 'data-file-name')?.trim() || linkInnerText(tag);
      if (!path) {
        return `<span style="color:#888;">${escapeHtml(name)}</span>`;
      }
      const url = await signedStorageUrl(supabase, path);
      if (!url) {
        return `<span style="color:#888;">${escapeHtml(name)} (unavailable)</span>`;
      }
      return `<a href="${escapeHref(url)}" style="color:#111;text-decoration:underline;font-size:14px;">${escapeHtml(name)}</a>`;
    }
  );

  return `<div style="margin:0;font-size:15px;line-height:1.55;color:#111;">${html}</div>`;
}
