import { useEffect } from 'react';
import { X } from 'lucide-react';

interface UnderConstructionModalProps {
  onClose: () => void;
}

export default function UnderConstructionModal({ onClose }: UnderConstructionModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center modal-backdrop px-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md border site-border site-surface px-8 py-10 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-5 right-5 site-link-subtle transition-colors"
          onClick={onClose}
          aria-label="Close notice"
        >
          <X size={20} strokeWidth={1.5} />
        </button>

        <span className="font-sans text-[0.65rem] tracking-[0.3em] uppercase text-[var(--color-accent)] block mb-4">
          Notice
        </span>
        <p className="font-sans text-sm leading-relaxed site-text-muted mb-8">
          This page is still under construction
        </p>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 font-sans text-xs tracking-[0.25em] uppercase border site-border site-link-muted hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors duration-300"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
