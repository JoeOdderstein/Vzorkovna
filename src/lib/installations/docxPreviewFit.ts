/** Scale docx-preview output to fit the viewport (mobile page width is ~816px by default). */
export function attachDocxPreviewFitToWidth(
  viewport: HTMLElement,
  mount: HTMLElement,
): () => void {
  let raf = 0;

  const apply = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const wrapper = mount.querySelector('.docx-wrapper') as HTMLElement | null;
      if (!wrapper) {
        mount.style.height = '';
        return;
      }

      wrapper.style.transform = 'none';
      wrapper.style.transformOrigin = '';
      wrapper.style.width = '';
      mount.style.height = '';
      mount.style.overflow = '';

      const available = viewport.clientWidth;
      const contentWidth = wrapper.scrollWidth;
      if (available <= 0 || contentWidth <= 0) return;

      const scale = Math.min(1, available / contentWidth);
      if (scale >= 0.995) return;

      const contentHeight = wrapper.scrollHeight;
      wrapper.style.transformOrigin = 'top left';
      wrapper.style.transform = `scale(${scale})`;
      wrapper.style.width = `${contentWidth}px`;
      mount.style.height = `${Math.ceil(contentHeight * scale)}px`;
      mount.style.overflow = 'hidden';
    });
  };

  apply();
  const resizeObserver = new ResizeObserver(apply);
  resizeObserver.observe(viewport);

  const onWindowResize = () => apply();
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('orientationchange', onWindowResize);

  const delayed = window.setTimeout(apply, 400);

  return () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(delayed);
    resizeObserver.disconnect();
    window.removeEventListener('resize', onWindowResize);
    window.removeEventListener('orientationchange', onWindowResize);
  };
}
