import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTaskboardTheme } from '../../context/TaskboardThemeContext';

interface TaskPhotoLightboxProps {
  imageUrl: string;
  fileName?: string;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export default function TaskPhotoLightbox({
  imageUrl,
  fileName,
  onClose,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
}: TaskPhotoLightboxProps) {
  const { theme } = useTaskboardTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowLeft' && hasPrevious && onPrevious) {
        e.preventDefault();
        onPrevious();
      }
      if (e.key === 'ArrowRight' && hasNext && onNext) {
        e.preventDefault();
        onNext();
      }
    };

    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, onPrevious, onNext, hasPrevious, hasNext]);

  return createPortal(
    <div
      className="taskboard fixed inset-0 z-[90] flex flex-col"
      data-theme={theme}
      role="dialog"
      aria-modal="true"
      aria-label={fileName ? `Photo: ${fileName}` : 'Photo preview'}
    >
      <button
        type="button"
        className="absolute inset-0 tb-overlay cursor-default"
        aria-label="Close photo"
        onClick={onClose}
      />

      <div className="relative z-10 flex items-center justify-center flex-1 p-4 pt-14 pb-6 pointer-events-none">
        <img
          src={imageUrl}
          alt={fileName ?? ''}
          className="pointer-events-auto max-h-[min(85vh,900px)] max-w-[min(92vw,1200px)] w-auto h-auto object-contain rounded-lg shadow-2xl"
        />
      </div>

      <div className="relative z-10 flex items-center justify-between gap-3 px-4 pb-4 pointer-events-none">
        <div className="pointer-events-auto min-w-0 flex-1">
          {fileName && (
            <p className="text-sm text-white/90 truncate drop-shadow-md">{fileName}</p>
          )}
        </div>
        <div className="pointer-events-auto flex items-center gap-2 shrink-0">
          {hasPrevious && onPrevious && (
            <button
              type="button"
              onClick={onPrevious}
              className="tb-photo-lightbox-btn"
              aria-label="Previous photo"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          {hasNext && onNext && (
            <button
              type="button"
              onClick={onNext}
              className="tb-photo-lightbox-btn"
              aria-label="Next photo"
            >
              <ChevronRight size={22} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="tb-photo-lightbox-btn"
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
