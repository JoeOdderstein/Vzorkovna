import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

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
      className="taskboard fixed inset-0 z-[90] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        className="absolute inset-0 tb-overlay cursor-default"
        aria-label="Close document"
        onClick={onClose}
      />

      <div className="relative z-10 flex items-center justify-between gap-3 px-4 pt-4 pb-2">
        <p className="text-sm text-white/90 truncate drop-shadow-md min-w-0 flex-1">{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto shrink-0 rounded-full p-2 text-white/90 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X size={22} />
        </button>
      </div>

      <div className="relative z-10 flex flex-1 justify-center px-4 pb-6 min-h-0">
        <iframe
          title={title}
          src={pdfUrl}
          className="pointer-events-auto w-full max-w-5xl h-full min-h-[70vh] rounded-lg bg-white shadow-2xl border-0"
        />
      </div>
    </div>,
    document.body
  );
}
