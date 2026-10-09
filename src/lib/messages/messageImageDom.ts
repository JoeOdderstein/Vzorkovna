/** Editor/feed wrapper around inline message images. */
export const MESSAGE_IMAGE_BLOCK_CLASS = 'message-image-block';

/** Move the image out of the wrapper, then remove the wrapper (img must not replace block in-place). */
export function unwrapMessageImageBlockElement(block: Element): void {
  const parent = block.parentNode;
  const img = block.querySelector('img');
  if (parent && img) {
    parent.insertBefore(img, block);
  }
  block.remove();
}
