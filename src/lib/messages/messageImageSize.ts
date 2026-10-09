/** Default inline size for message images in compose + feed. */
export const MESSAGE_IMAGE_DEFAULT_WIDTH_PX = 220;
export const MESSAGE_IMAGE_MAX_HEIGHT_PX = 128;
export const MESSAGE_IMAGE_MIN_WIDTH_PX = 88;
export const MESSAGE_IMAGE_MAX_WIDTH_CAP_PX = 220;
export const MESSAGE_IMAGE_MAX_WIDTH_FRACTION = 0.48;

export function defaultMessageImageWidthPx(containerWidth?: number): number {
  if (!containerWidth || containerWidth <= 0) {
    return MESSAGE_IMAGE_DEFAULT_WIDTH_PX;
  }
  return Math.min(
    MESSAGE_IMAGE_MAX_WIDTH_CAP_PX,
    Math.max(
      MESSAGE_IMAGE_MIN_WIDTH_PX + 20,
      Math.floor(containerWidth * MESSAGE_IMAGE_MAX_WIDTH_FRACTION)
    )
  );
}

export const MESSAGE_IMAGE_DEFAULT_STYLE = `width: ${MESSAGE_IMAGE_DEFAULT_WIDTH_PX}px; max-width: 100%; height: auto;`;

export function sanitizeImageSizeStyle(style: string): string {
  const widthMatch = style.match(/width:\s*([0-9.]+px|[0-9.]+%)/i);
  if (!widthMatch) return MESSAGE_IMAGE_DEFAULT_STYLE;
  return `width: ${widthMatch[1]}; max-width: 100%; height: auto;`;
}
