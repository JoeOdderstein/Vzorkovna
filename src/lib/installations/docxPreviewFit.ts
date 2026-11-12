/** docx-preview default US Letter content width when ignoreWidth is off. */
const DOCX_PAGE_WIDTH_PX = 816;

export function findDocxPreviewWrapper(mount: HTMLElement): HTMLElement | null {
  const byClass =
    mount.querySelector('.installation-docx-preview-wrapper') ??
    mount.querySelector('.docx-wrapper');
  if (byClass instanceof HTMLElement) return byClass;
  const first = mount.firstElementChild;
  return first instanceof HTMLElement ? first : null;
}

function clearScaledLayout(clip: HTMLElement, mount: HTMLElement, wrapper: HTMLElement | null) {
  if (wrapper) {
    wrapper.style.transform = '';
    wrapper.style.transformOrigin = '';
    wrapper.style.zoom = '';
    wrapper.style.width = '';
  }
  clip.style.width = '';
  clip.style.height = '';
  clip.style.marginLeft = '';
  clip.style.marginRight = '';
  clip.style.overflow = '';
  mount.style.height = '';
  mount.style.overflow = '';
  mount.style.width = '';
}

/** Scale docx-preview output to fit the viewport width on phones. */
export function attachDocxPreviewFitToWidth(
  viewport: HTMLElement,
  clip: HTMLElement,
  mount: HTMLElement,
): () => void {
  let raf = 0;
  let mutationFlush = 0;

  const measureAvailableWidth = (): number => {
    const rect = viewport.getBoundingClientRect();
    const padX =
      parseFloat(getComputedStyle(viewport).paddingLeft) +
      parseFloat(getComputedStyle(viewport).paddingRight);
    return Math.max(0, rect.width - padX);
  };

  const measureContentWidth = (wrapper: HTMLElement): number => {
    let max = Math.max(
      wrapper.scrollWidth,
      wrapper.offsetWidth,
      wrapper.getBoundingClientRect().width,
      DOCX_PAGE_WIDTH_PX,
    );
    for (const section of wrapper.querySelectorAll('section')) {
      if (!(section instanceof HTMLElement)) continue;
      max = Math.max(max, section.offsetWidth, section.scrollWidth);
    }
    for (const table of wrapper.querySelectorAll('table')) {
      if (!(table instanceof HTMLElement)) continue;
      max = Math.max(max, table.scrollWidth);
    }
    return max;
  };

  const apply = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const wrapper = findDocxPreviewWrapper(mount);
      if (!wrapper) {
        clearScaledLayout(clip, mount, null);
        return;
      }

      clearScaledLayout(clip, mount, wrapper);

      const available = measureAvailableWidth();
      if (available <= 0) return;

      const contentWidth = measureContentWidth(wrapper);
      const scale = Math.min(1, available / contentWidth);
      if (scale >= 1) return;

      const contentHeight = Math.max(wrapper.scrollHeight, wrapper.offsetHeight);
      const scaledWidth = contentWidth * scale;
      const scaledHeight = contentHeight * scale;

      clip.style.width = `${scaledWidth}px`;
      clip.style.height = `${Math.ceil(scaledHeight)}px`;
      clip.style.marginLeft = 'auto';
      clip.style.marginRight = 'auto';
      clip.style.overflow = 'hidden';

      wrapper.style.transformOrigin = 'top left';
      wrapper.style.transform = `scale(${scale})`;
      wrapper.style.width = `${contentWidth}px`;

      mount.style.width = `${contentWidth}px`;
      mount.style.height = `${contentHeight}px`;

      for (const img of wrapper.querySelectorAll('img')) {
        if (img.complete) continue;
        img.addEventListener('load', () => apply(), { once: true });
        img.addEventListener('error', () => apply(), { once: true });
      }
    });
  };

  const scheduleMutationApply = () => {
    window.clearTimeout(mutationFlush);
    mutationFlush = window.setTimeout(apply, 60);
  };

  apply();

  const resizeObserver = new ResizeObserver(apply);
  resizeObserver.observe(viewport);

  const mutationObserver = new MutationObserver(scheduleMutationApply);
  mutationObserver.observe(mount, { childList: true, subtree: true, attributes: true });

  const onLayout = () => apply();
  window.addEventListener('resize', onLayout);
  window.visualViewport?.addEventListener('resize', onLayout);
  window.visualViewport?.addEventListener('scroll', onLayout);

  const delayedIds = [50, 150, 400, 900, 2000].map((ms) => window.setTimeout(apply, ms));

  return () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(mutationFlush);
    for (const id of delayedIds) window.clearTimeout(id);
    resizeObserver.disconnect();
    mutationObserver.disconnect();
    window.removeEventListener('resize', onLayout);
    window.visualViewport?.removeEventListener('resize', onLayout);
    window.visualViewport?.removeEventListener('scroll', onLayout);
    clearScaledLayout(clip, mount, findDocxPreviewWrapper(mount));
  };
}
