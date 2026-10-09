import DOMPurify from 'dompurify';
import {
  MESSAGE_IMAGE_BLOCK_CLASS,
  unwrapMessageImageBlockElement,
} from './messageImageDom';
import { resolveMessageAttachmentLinks } from './messageAttachmentHtml';
import { getMessageImageUrl, messageImageStoragePathFromElement } from './messageImageService';
import { MESSAGE_IMAGE_DEFAULT_STYLE, sanitizeImageSizeStyle } from './messageImageSize';

const ALLOWED_TAGS = [
  'p',
  'br',
  'div',
  'span',
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'strike',
  'ul',
  'ol',
  'li',
  'a',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'sub',
  'sup',
  'img',
];

const HTML_BODY_PATTERN =
  /<\/?(?:p|br|div|span|strong|b|em|i|u|ul|ol|li|h[1-6]|font|img)\b/i;

const PURIFY_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR: ['style', 'class', 'src', 'alt', 'loading', 'href', 'target', 'rel'],
  ADD_ATTR: ['data-storage-path', 'data-file-name', 'data-message-attachments'],
  ALLOW_DATA_ATTR: true,
} as const;

export function isLikelyHtmlMessageBody(body: string): boolean {
  return HTML_BODY_PATTERN.test(body.trim());
}

export function sanitizeMessageHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, PURIFY_CONFIG).trim();
}

/** Normalize draft/restore HTML (unwrap editor-only image chrome). */
export function prepareMessageComposeDraftBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return '';
  if (typeof document === 'undefined') return sanitizeMessageHtml(trimmed);
  const div = document.createElement('div');
  div.innerHTML = sanitizeMessageHtml(trimmed);
  for (const block of div.querySelectorAll(`.${MESSAGE_IMAGE_BLOCK_CLASS}`)) {
    unwrapMessageImageBlockElement(block);
  }
  return div.innerHTML.trim();
}

/** Persist storage paths only — omit transient signed/blob URLs from saved body. */
export function normalizeMessageImagesInHtml(html: string): string {
  if (typeof document === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;

  for (const block of div.querySelectorAll(`.${MESSAGE_IMAGE_BLOCK_CLASS}`)) {
    unwrapMessageImageBlockElement(block);
  }

  for (const img of div.querySelectorAll('img')) {
    const path = messageImageStoragePathFromElement(img);
    if (!path) {
      img.remove();
      continue;
    }
    img.setAttribute('data-storage-path', path);
    img.setAttribute('alt', img.getAttribute('alt') ?? '');
    img.setAttribute('class', 'message-inline-image');
    img.setAttribute('loading', 'lazy');
    const style = img.getAttribute('style');
    if (style?.includes('width')) {
      img.setAttribute('style', sanitizeImageSizeStyle(style));
    } else {
      img.setAttribute('style', MESSAGE_IMAGE_DEFAULT_STYLE);
    }
    img.removeAttribute('src');
  }

  return sanitizeMessageHtml(div.innerHTML).trim();
}

export async function resolveMessageBodyHtml(body: string): Promise<string> {
  const trimmed = body.trim();
  if (!trimmed) return '';
  if (!isLikelyHtmlMessageBody(trimmed)) {
    return trimmed;
  }
  const clean = sanitizeMessageHtml(trimmed);
  if (typeof document === 'undefined') return clean;

  const div = document.createElement('div');
  div.innerHTML = clean;

  const images = div.querySelectorAll('img');
  await Promise.all(
    Array.from(images).map(async (img) => {
      const path = messageImageStoragePathFromElement(img);
      if (!path) return;
      img.setAttribute('data-storage-path', path);
      img.classList.add('message-inline-image');
      if (!img.getAttribute('style')?.includes('width')) {
        img.setAttribute('style', MESSAGE_IMAGE_DEFAULT_STYLE);
      }
      img.removeAttribute('loading');
      try {
        const url = await getMessageImageUrl(path);
        img.setAttribute('src', url);
      } catch {
        img.setAttribute('alt', 'Image unavailable');
      }
    })
  );

  return resolveMessageAttachmentLinks(div.innerHTML);
}

export function plainTextToEditorHtml(plain: string): string {
  const trimmed = plain.trim();
  if (!trimmed) return '';
  if (isLikelyHtmlMessageBody(trimmed)) {
    return sanitizeMessageHtml(trimmed);
  }
  const escaped = plain
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(/\n/g, '<br>');
}

export function messageBodyToPlainText(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return '';
  if (typeof document === 'undefined') {
    return trimmed.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const div = document.createElement('div');
  div.innerHTML = isLikelyHtmlMessageBody(trimmed) ? sanitizeMessageHtml(trimmed) : trimmed;
  return (div.textContent ?? '').replace(/\u00a0/g, ' ').trim();
}

export function htmlMessageHasContent(html: string): boolean {
  if (messageBodyToPlainText(html).length > 0) return true;
  if (typeof document === 'undefined') {
    return /<img[\s>]/i.test(html);
  }
  const div = document.createElement('div');
  div.innerHTML = sanitizeMessageHtml(html);
  return (
    div.querySelector('img[data-storage-path], img[src], a.message-file-attachment[data-storage-path]') !=
    null
  );
}

/** Normalize body before save (plain text unchanged; rich text sanitized). */
export function normalizeOutgoingMessageBody(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (isLikelyHtmlMessageBody(trimmed)) {
    return normalizeMessageImagesInHtml(trimmed);
  }
  return trimmed;
}
