import { useEffect, useState } from 'react';

/** Mobile browsers often fail to render remote PDFs in iframes; blob URLs work reliably. */
function useMobilePdfBlobUrl(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches;
}

export function usePdfEmbedUrl(sourceUrl: string | undefined | null) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    if (!sourceUrl) {
      setEmbedUrl(null);
      setPreparing(false);
      return;
    }

    let blobUrl: string | null = null;
    let cancelled = false;

    if (!useMobilePdfBlobUrl()) {
      setEmbedUrl(sourceUrl);
      setPreparing(false);
      return () => {
        cancelled = true;
      };
    }

    setPreparing(true);
    setEmbedUrl(null);

    void fetch(sourceUrl)
      .then((res) => {
        if (!res.ok) throw new Error('PDF fetch failed');
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        blobUrl = URL.createObjectURL(blob);
        setEmbedUrl(blobUrl);
      })
      .catch(() => {
        if (!cancelled) setEmbedUrl(sourceUrl);
      })
      .finally(() => {
        if (!cancelled) setPreparing(false);
      });

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [sourceUrl]);

  return { embedUrl, preparing };
}
