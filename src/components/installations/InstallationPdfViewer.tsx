import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import InstallationPdfEmbed from './InstallationPdfEmbed';

interface InstallationPdfViewerProps {
  pdfUrl: string;
  title: string;
  onClose: () => void;
}

export default function InstallationPdfViewer({
  pdfUrl,
  title,
  onClose,
}: InstallationPdfViewerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="taskboard tb-pdf-viewer-overlay fixed inset-0 z-[90] flex flex-col min-h-0 bg-[var(--tb-bg)]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="shrink-0 flex items-center justify-between gap-3 px-3 py-2 md:px-4 border-b border-[var(--tb-border)] bg-[var(--tb-surface)]">
        <p className="text-sm tb-text font-medium truncate min-w-0 flex-1">{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md p-2 tb-muted hover:tb-text hover:bg-[var(--tb-border)]/30 transition-colors"
          aria-label="Close"
        >
          <X size={22} />
        </button>
      </div>

      <div className="flex-1 min-h-0 w-full overflow-hidden">
        <InstallationPdfEmbed
          pdfUrl={pdfUrl}
          title={title}
          showMobileOpenLink={false}
          fill
        />
      </div>
    </div>,
    document.body
  );
}
