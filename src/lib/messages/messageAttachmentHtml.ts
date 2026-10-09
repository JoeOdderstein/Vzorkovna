import { getMessageFileUrl } from './messageFileService';

export const MESSAGE_ATTACHMENTS_ROOT_CLASS = 'message-attachments';
export const MESSAGE_FILE_LINK_CLASS = 'message-file-attachment';

export type MessageAttachmentRef = {
  storagePath: string;
  fileName: string;
};

export function buildMessageAttachmentsHtml(attachments: MessageAttachmentRef[]): string {
  if (attachments.length === 0) return '';
  const items = attachments
    .map(
      (file) =>
        `<li><a class="${MESSAGE_FILE_LINK_CLASS}" href="#" data-storage-path="${escapeAttr(
          file.storagePath
        )}" data-file-name="${escapeAttr(file.fileName)}">${escapeText(file.fileName)}</a></li>`
    )
    .join('');
  return `<div class="${MESSAGE_ATTACHMENTS_ROOT_CLASS}" data-message-attachments><ul class="message-attachments__list">${items}</ul></div>`;
}

export function appendMessageAttachmentsHtml(
  body: string,
  attachments: MessageAttachmentRef[]
): string {
  if (attachments.length === 0) return body;
  const block = buildMessageAttachmentsHtml(attachments);
  const trimmed = body.trim();
  if (!trimmed) return block;
  if (/<\/?[a-z][\s>]/i.test(trimmed)) {
    return `${trimmed}${block}`;
  }
  const escaped = trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return `${escaped}${block}`;
}

export async function resolveMessageAttachmentLinks(html: string): Promise<string> {
  if (typeof document === 'undefined') return html;
  const div = document.createElement('div');
  // Caller already sanitized full message HTML (incl. inline images). Attachment-only
  // sanitize would strip <img> and other rich-text tags.
  div.innerHTML = html;

  const links = div.querySelectorAll(`a.${MESSAGE_FILE_LINK_CLASS}`);
  await Promise.all(
    Array.from(links).map(async (anchor) => {
      const path = anchor.getAttribute('data-storage-path')?.trim();
      const name = anchor.getAttribute('data-file-name')?.trim();
      if (!path) return;
      if (name) anchor.textContent = name;
      try {
        const url = await getMessageFileUrl(path);
        anchor.setAttribute('href', url);
        anchor.setAttribute('target', '_blank');
        anchor.setAttribute('rel', 'noopener noreferrer');
      } catch {
        anchor.removeAttribute('href');
        anchor.classList.add('message-file-attachment--unavailable');
      }
    })
  );

  return div.innerHTML;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
