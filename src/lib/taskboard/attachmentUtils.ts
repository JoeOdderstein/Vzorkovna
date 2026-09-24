const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif']);

export function isImageAttachment(
  attachmentName: string | null | undefined,
  attachmentPath?: string | null
): boolean {
  const fromName = extensionFromFilename(attachmentName);
  if (fromName && IMAGE_EXTENSIONS.has(fromName)) return true;
  const fromPath = extensionFromFilename(attachmentPath);
  return Boolean(fromPath && IMAGE_EXTENSIONS.has(fromPath));
}

function extensionFromFilename(value: string | null | undefined): string | null {
  if (!value) return null;
  const base = value.split('/').pop() ?? value;
  const dot = base.lastIndexOf('.');
  if (dot === -1) return null;
  return base.slice(dot + 1).toLowerCase();
}

export const IMAGE_UPLOAD_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
