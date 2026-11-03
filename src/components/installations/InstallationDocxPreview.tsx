import { useEffect, useRef, useState } from 'react';
import { defaultOptions, renderAsync } from 'docx-preview';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { attachDocxPreviewFitToWidth } from '../../lib/installations/docxPreviewFit';

interface InstallationDocxPreviewProps {
  documentUrl: string;
}

export default function InstallationDocxPreview({ documentUrl }: InstallationDocxPreviewProps) {
  const { t } = useTaskboardI18n();
  const viewportRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const viewportEl = viewportRef.current;
    const bodyEl = bodyRef.current;
    const styleEl = styleRef.current;
    if (!viewportEl || !bodyEl || !styleEl) return;

    let cancelled = false;
    let detachFit: (() => void) | undefined;
    setLoading(true);
    setError('');
    bodyEl.replaceChildren();
    styleEl.replaceChildren();
    bodyEl.style.height = '';
    bodyEl.style.overflow = '';

    void (async () => {
      try {
        const response = await fetch(documentUrl);
        if (!response.ok) throw new Error('fetch failed');
        const blob = await response.blob();
        if (cancelled) return;
        await renderAsync(blob, bodyEl, styleEl, {
          ...defaultOptions,
          className: 'installation-docx-preview',
          inWrapper: true,
          breakPages: false,
        });
        if (cancelled) return;
        detachFit = attachDocxPreviewFitToWidth(viewportEl, bodyEl);
      } catch {
        if (!cancelled) setError(t('projects.tech.docxPreviewError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      detachFit?.();
      bodyEl.replaceChildren();
      styleEl.replaceChildren();
      bodyEl.style.height = '';
      bodyEl.style.overflow = '';
    };
  }, [documentUrl, t]);

  return (
    <div className="relative w-full min-h-[min(72vh,40rem)] max-h-[min(72vh,40rem)] overflow-y-auto overscroll-contain bg-white installation-docx-preview-viewport">
      {loading ? (
        <p className="absolute inset-x-0 top-8 z-[1] px-4 text-sm tb-muted text-center pointer-events-none">
          {t('projects.tech.docxPreviewLoading')}
        </p>
      ) : null}
      {error ? (
        <p className="absolute inset-x-0 top-8 z-[1] px-4 text-sm text-red-600 text-center">{error}</p>
      ) : null}
      <div ref={styleRef} className="sr-only" aria-hidden />
      <div ref={viewportRef} className="w-full overflow-x-hidden px-0 sm:px-2 py-2 sm:py-4">
        <div ref={bodyRef} className="installation-docx-preview-root" />
      </div>
    </div>
  );
}
