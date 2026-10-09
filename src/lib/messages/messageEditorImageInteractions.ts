import {
  MESSAGE_IMAGE_BLOCK_CLASS,
  unwrapMessageImageBlockElement,
} from './messageImageDom';
import { messageImageStoragePathFromElement } from './messageImageService';
import {
  defaultMessageImageWidthPx,
  MESSAGE_IMAGE_DEFAULT_STYLE,
  MESSAGE_IMAGE_MAX_HEIGHT_PX,
  MESSAGE_IMAGE_MIN_WIDTH_PX,
} from './messageImageSize';

const BLOCK_CLASS = MESSAGE_IMAGE_BLOCK_CLASS;
const HANDLE_CLASS = 'message-image-resize-handle';
const IMAGE_CLASS = 'message-inline-image';
const MOVE_THRESHOLD_PX = 5;

function defaultMaxWidthPx(container?: HTMLElement): number {
  return defaultMessageImageWidthPx(container?.clientWidth);
}

/** Scale new images down so they fit inline in the compose box (not full resolution). */
export function applyDefaultInlineImageSize(img: HTMLImageElement, container?: HTMLElement) {
  if (img.dataset.userSized === '1') return;

  const maxW = defaultMaxWidthPx(container);
  const maxH = MESSAGE_IMAGE_MAX_HEIGHT_PX;

  const apply = () => {
    let naturalW = img.naturalWidth;
    let naturalH = img.naturalHeight;
    if (!naturalW || !naturalH) {
      img.style.width = `${maxW}px`;
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.style.verticalAlign = 'middle';
      return;
    }
    const scale = Math.min(maxW / naturalW, maxH / naturalH, 1);
    const targetW = Math.max(MESSAGE_IMAGE_MIN_WIDTH_PX, Math.round(naturalW * scale));
    img.style.width = `${targetW}px`;
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.style.verticalAlign = 'middle';
  };

  img.style.maxWidth = '100%';
  img.style.height = 'auto';
  img.style.verticalAlign = 'middle';
  img.style.width = `${maxW}px`;

  if (img.complete && img.naturalWidth > 0) {
    apply();
  } else {
    img.addEventListener('load', apply, { once: true });
  }
}

function createImageBlockShell(): { block: HTMLSpanElement; handle: HTMLSpanElement } {
  const block = document.createElement('span');
  block.className = BLOCK_CLASS;
  block.contentEditable = 'false';

  const handle = document.createElement('span');
  handle.className = HANDLE_CLASS;
  handle.setAttribute('data-resize-handle', 'true');
  handle.setAttribute('aria-hidden', 'true');

  return { block, handle };
}

function prepareInlineImage(img: HTMLImageElement, container?: HTMLElement): void {
  img.classList.add(IMAGE_CLASS);
  if (!img.getAttribute('alt')) img.setAttribute('alt', '');
  if (img.dataset.userSized !== '1') {
    applyDefaultInlineImageSize(img, container);
  }
}

/** Apply thumbnail sizing to all compose images (call before serialize). */
export function ensureEditorInlineImageSizes(root: HTMLElement): void {
  const images = root.querySelectorAll(
    `img.${IMAGE_CLASS}, img[data-storage-path], .${BLOCK_CLASS} img`
  );
  for (const node of images) {
    if (!(node instanceof HTMLImageElement)) continue;
    if (node.dataset.userSized === '1') continue;
    applyDefaultInlineImageSize(node, root);
  }
}

/** Wrap a detached image (paste / insert at caret). */
function wrapImage(img: HTMLImageElement, container?: HTMLElement): HTMLSpanElement {
  const { block, handle } = createImageBlockShell();
  prepareInlineImage(img, container);
  block.append(img, handle);
  return block;
}

/** Replace an in-DOM image with a wrapper block (must not append img to block first). */
function wrapImageInDom(img: HTMLImageElement, container?: HTMLElement): void {
  const parent = img.parentNode;
  if (!parent) return;
  const { block, handle } = createImageBlockShell();
  prepareInlineImage(img, container);
  parent.replaceChild(block, img);
  block.append(img, handle);
}

function shouldApplyDefaultSize(img: HTMLImageElement): boolean {
  if (img.dataset.userSized === '1') return false;
  const w = img.style.width;
  if (!w) return true;
  const px = Number.parseFloat(w);
  if (!Number.isFinite(px)) return true;
  return px > defaultMessageImageWidthPx() * 1.5;
}

export function upgradeMessageImagesInEditor(root: HTMLElement) {
  const images = Array.from(
    root.querySelectorAll(`img.${IMAGE_CLASS}, img[data-storage-path], img[src]`)
  );
  for (const img of images) {
    if (!(img instanceof HTMLImageElement)) continue;
    if (!root.contains(img)) continue;
    if (!img.getAttribute('data-storage-path') && !img.getAttribute('src')?.trim()) continue;
    try {
      const existingBlock = img.closest(`.${BLOCK_CLASS}`);
      if (existingBlock) {
        if (shouldApplyDefaultSize(img)) {
          img.removeAttribute('style');
          applyDefaultInlineImageSize(img, root);
        }
        continue;
      }
      if (shouldApplyDefaultSize(img)) {
        img.removeAttribute('style');
      }
      wrapImageInDom(img, root);
    } catch (err) {
      console.warn('Message editor: could not upgrade inline image', err);
    }
  }
}

function caretRangeFromPoint(x: number, y: number): Range | null {
  if (document.caretRangeFromPoint) {
    return document.caretRangeFromPoint(x, y);
  }
  const pos = document.caretPositionFromPoint?.(x, y);
  if (!pos) return null;
  const range = document.createRange();
  range.setStart(pos.offsetNode, pos.offset);
  range.collapse(true);
  return range;
}

function rangeAtEnd(root: HTMLElement): Range {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  return range;
}

function currentSelectionRangeIn(root: HTMLElement): Range | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return null;
  return range;
}

function selectRange(range: Range) {
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function imageBlockFromNode(node: Node): HTMLElement | null {
  if (node instanceof HTMLElement && node.classList.contains(BLOCK_CLASS)) {
    return node;
  }
  return node.parentElement?.closest(`.${BLOCK_CLASS}`) ?? null;
}

/** Find a drop position in the editor, even when the pointer is over an image. */
export function dropRangeFromPoint(
  root: HTMLElement,
  x: number,
  y: number,
  movingBlock?: HTMLElement | null
): Range | null {
  if (movingBlock) {
    movingBlock.style.pointerEvents = 'none';
  }

  let range = caretRangeFromPoint(x, y);

  if (movingBlock) {
    movingBlock.style.pointerEvents = '';
  }

  if (range && root.contains(range.startContainer)) {
    const hitBlock = imageBlockFromNode(range.startContainer);
    if (hitBlock && hitBlock !== movingBlock) {
      const rect = hitBlock.getBoundingClientRect();
      range = document.createRange();
      if (x < rect.left + rect.width / 2) {
        range.setStartBefore(hitBlock);
      } else {
        range.setStartAfter(hitBlock);
      }
      range.collapse(true);
      return range;
    }
    if (!hitBlock || hitBlock === movingBlock) {
      return range;
    }
  }

  const el = document.elementFromPoint(x, y);
  if (!el || !root.contains(el)) return null;

  const block = el.closest(`.${BLOCK_CLASS}`);
  if (block instanceof HTMLElement && root.contains(block)) {
    const rect = block.getBoundingClientRect();
    range = document.createRange();
    if (x < rect.left + rect.width / 2) {
      range.setStartBefore(block);
    } else {
      range.setStartAfter(block);
    }
    range.collapse(true);
    return range;
  }

  if (root === el || root.contains(el)) {
    return rangeAtEnd(root);
  }

  return null;
}

export function insertImageAtCaret(root: HTMLElement, img: HTMLImageElement): void {
  const block = wrapImage(img, root);
  root.focus();
  const range = currentSelectionRangeIn(root) ?? rangeAtEnd(root);
  range.collapse(true);
  range.insertNode(block);

  const spacer = document.createTextNode('\u200B');
  range.setStartAfter(block);
  range.collapse(true);
  range.insertNode(spacer);

  const after = document.createRange();
  after.setStartAfter(spacer);
  after.collapse(true);
  selectRange(after);
}

export type MessageImageEditorLabels = {
  resize: string;
  delete: string;
};

export type MessageImageEditorOptions = {
  onUpdate: () => void;
  isDisabled: () => boolean;
  labels: MessageImageEditorLabels;
};

export function attachMessageImageEditorListeners(
  root: HTMLElement,
  options: MessageImageEditorOptions
): () => void {

  let selectedBlock: HTMLElement | null = null;
  let toolbarEl: HTMLDivElement | null = null;

  const clearSelectionClasses = () => {
    root.querySelectorAll('.message-image-block--selected, .message-image-block--resize-active').forEach((el) => {
      el.classList.remove('message-image-block--selected', 'message-image-block--resize-active');
    });
  };

  const removeToolbar = () => {
    toolbarEl?.remove();
    toolbarEl = null;
    clearSelectionClasses();
    selectedBlock = null;
  };

  const positionToolbar = (toolbar: HTMLElement, block: HTMLElement) => {
    const br = block.getBoundingClientRect();
    const margin = 8;
    let top = br.top - toolbar.offsetHeight - margin;
    if (top < margin) {
      top = br.bottom + margin;
    }
    toolbar.style.position = 'fixed';
    toolbar.style.top = `${top}px`;
    toolbar.style.left = `${Math.max(margin, br.left)}px`;
    toolbar.style.zIndex = '10000';
  };

  const showToolbar = (block: HTMLElement) => {
    if (!root.isConnected) return;
    removeToolbar();
    selectedBlock = block;
    block.classList.add('message-image-block--selected');

    const bar = document.createElement('div');
    bar.className = 'message-image-toolbar';
    bar.setAttribute('role', 'toolbar');

    const resizeBtn = document.createElement('button');
    resizeBtn.type = 'button';
    resizeBtn.className = 'message-image-toolbar__btn';
    resizeBtn.textContent = options.labels.resize;
    resizeBtn.dataset.action = 'resize';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'message-image-toolbar__btn message-image-toolbar__btn--danger';
    deleteBtn.textContent = options.labels.delete;
    deleteBtn.dataset.action = 'delete';

    bar.append(resizeBtn, deleteBtn);
    document.body.appendChild(bar);
    toolbarEl = bar;
    positionToolbar(bar, block);

    const stopToolbarPointer = (ev: Event) => {
      ev.preventDefault();
      ev.stopPropagation();
    };
    bar.addEventListener('pointerdown', stopToolbarPointer);
    bar.addEventListener('mousedown', stopToolbarPointer);

    const onResize = (ev: Event) => {
      ev.preventDefault();
      ev.stopPropagation();
      block.classList.remove('message-image-block--selected');
      block.classList.add('message-image-block--resize-active');
      toolbarEl?.remove();
      toolbarEl = null;
      selectedBlock = block;
    };

    const onDelete = (ev: Event) => {
      ev.preventDefault();
      ev.stopPropagation();
      block.remove();
      removeToolbar();
      options.onUpdate();
    };

    resizeBtn.addEventListener('pointerup', onResize);
    deleteBtn.addEventListener('pointerup', onDelete);
  };

  let resize:
    | {
        img: HTMLImageElement;
        startX: number;
        startWidth: number;
      }
    | null = null;

  let moveBlock: HTMLElement | null = null;
  let moveStartX = 0;
  let moveStartY = 0;
  let moveActive = false;
  let suppressNextImageClick = false;

  const finishMove = (clientX: number, clientY: number) => {
    if (!moveBlock) return;
    const block = moveBlock;
    block.classList.remove('message-image-block--moving');
    moveBlock = null;
    moveActive = false;
    suppressNextImageClick = true;
    removeToolbar();

    const range = dropRangeFromPoint(root, clientX, clientY, block);
    if (range) {
      range.insertNode(block);
      const after = document.createRange();
      after.setStartAfter(block);
      after.collapse(true);
      selectRange(after);
      options.onUpdate();
    }
  };

  const onDocumentPointerDown = (e: PointerEvent) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest('.message-image-toolbar')) return;
    if (root.contains(target) && target.closest(`.${BLOCK_CLASS}`)) return;
    removeToolbar();
  };

  const onPointerDown = (e: PointerEvent) => {
    if (options.isDisabled()) return;
    if (e.button !== 0) return;
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.closest('.message-image-toolbar')) {
      return;
    }

    if (target.hasAttribute('data-resize-handle')) {
      const block = target.closest(`.${BLOCK_CLASS}`);
      const img = block?.querySelector('img');
      if (!(img instanceof HTMLImageElement)) return;

      e.preventDefault();
      e.stopPropagation();
      removeToolbar();

      const rect = img.getBoundingClientRect();
      resize = {
        img,
        startX: e.clientX,
        startWidth: rect.width,
      };
      return;
    }

    const block = target.closest(`.${BLOCK_CLASS}`);
    if (!block || !root.contains(block)) {
      if (!target.closest(`.${BLOCK_CLASS}`)) {
        removeToolbar();
      }
      return;
    }

    e.preventDefault();

    moveBlock = block as HTMLElement;
    moveStartX = e.clientX;
    moveStartY = e.clientY;
    moveActive = false;

    const onMove = (ev: PointerEvent) => {
      if (!moveBlock) return;
      const dist = Math.hypot(ev.clientX - moveStartX, ev.clientY - moveStartY);
      if (!moveActive && dist < MOVE_THRESHOLD_PX) return;

      if (!moveActive) {
        moveActive = true;
        removeToolbar();
        moveBlock.classList.add('message-image-block--moving');
      }

      ev.preventDefault();
      const range = dropRangeFromPoint(root, ev.clientX, ev.clientY, moveBlock);
      if (range) {
        selectRange(range);
      }
    };

    const onUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      const blockEl = moveBlock;
      if (moveActive && blockEl) {
        finishMove(ev.clientX, ev.clientY);
      } else {
        blockEl?.classList.remove('message-image-block--moving');
        if (blockEl && root.contains(blockEl) && !suppressNextImageClick) {
          showToolbar(blockEl);
        }
        suppressNextImageClick = false;
      }
      moveBlock = null;
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!resize) return;
    const delta = e.clientX - resize.startX;
    const next = Math.min(720, Math.max(64, Math.round(resize.startWidth + delta)));
    resize.img.style.width = `${next}px`;
    resize.img.style.maxWidth = '100%';
    resize.img.style.height = 'auto';
    resize.img.dataset.userSized = '1';
  };

  const onMouseUp = () => {
    if (!resize) return;
    resize = null;
    options.onUpdate();
  };

  const onScroll = () => {
    if (toolbarEl && selectedBlock) {
      positionToolbar(toolbarEl, selectedBlock);
    }
  };

  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('pointerdown', onDocumentPointerDown, true);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('scroll', onScroll, { passive: true, capture: true });

  return () => {
    removeToolbar();
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('scroll', onScroll);
    document.removeEventListener('pointerdown', onDocumentPointerDown, true);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('scroll', onScroll, true);
  };
}

export function unwrapMessageImageBlocksForSave(root: HTMLElement): string {
  ensureEditorInlineImageSizes(root);
  const clone = root.cloneNode(true) as HTMLElement;
  for (const img of clone.querySelectorAll(`img.${IMAGE_CLASS}, img[data-storage-path], img[src]`)) {
    if (!(img instanceof HTMLImageElement)) continue;
    const path = messageImageStoragePathFromElement(img);
    if (path) {
      img.setAttribute('data-storage-path', path);
    }
    if (img.dataset.userSized !== '1' && !img.getAttribute('style')?.includes('width')) {
      img.setAttribute('style', MESSAGE_IMAGE_DEFAULT_STYLE);
    }
  }
  for (const block of clone.querySelectorAll(`.${BLOCK_CLASS}`)) {
    unwrapMessageImageBlockElement(block);
  }
  return clone.innerHTML.replace(/\u200B/g, '');
}
