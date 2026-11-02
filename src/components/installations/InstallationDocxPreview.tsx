import { useEffect, useRef, useState } from 'react';
import { defaultOptions, renderAsync } from 'docx-preview';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';

interface InstallationDocxPreviewProps {
  documentUrl: string;
}

export default function InstallationDocxPreview({ documentUrl }: InstallationDocxPreviewProps) {
  const { t } = useTaskboardI18n();
  const bodyRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const bodyEl = bodyRef.current;
    const styleEl = styleRef.current;
    if (!bodyEl || !styleEl) return;

    let cancelled = false;
    setLoading(true);
    setError('');
    bodyEl.replaceChildren();
    styleEl.replaceChildren();

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
        });
      } catch {
        if (!cancelled) setError(t('projects.tech.docxPreviewError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      bodyEl.replaceChildren();
      styleEl.replaceChildren();
    };
  }, [documentUrl, t]);

  return (
    <div className="relative w-full min-h-[min(72vh,40rem)] max-h-[min(72vh,40rem)] overflow-y-auto overscroll-contain bg-white">
      {loading ? (
        <p className="absolute inset-x-0 top-8 px-4 text-sm tb-muted text-center pointer-events-none">
          {t('projects.tech.docxPreviewLoading')}
        </p>
      ) : null}
      {error ? (
        <p className="absolute inset-x-0 top-8 px-4 text-sm text-red-600 text-center">{error}</p>
      ) : null}
      <div ref={styleRef} className="sr-only" aria-hidden />
      <div ref={bodyRef} className="installation-docx-preview-root px-2 py-4" />
    </div>
  );
}
