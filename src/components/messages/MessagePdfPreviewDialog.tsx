import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, X } from 'lucide-react';
import { useTaskboardTheme } from '../../context/TaskboardThemeContext';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';

interface MessagePdfPreviewDialogProps {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
  onDownload: () => void | Promise<void>;
}

export default function MessagePdfPreviewDialog({
  fileUrl,
  fileName,
  onClose,
  onDownload,
}: MessagePdfPreviewDialogProps) {
  const { theme } = useTaskboardTheme();
  const { t } = useTaskboardI18n();

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
      data-theme={theme}
      role="dialog"
      aria-modal="true"
      aria-label={fileName}
    >
      <button
        type="button"
        className="absolute inset-0 tb-overlay cursor-default"
        aria-label={t('common.close')}
        onClick={onClose}
      />

      <div className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--tb-border)] bg-[var(--tb-surface)] pointer-events-auto">
        <p className="text-sm font-medium truncate min-w-0 flex-1">{fileName}</p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            className="tb-btn-secondary text-sm inline-flex items-center gap-1.5 px-3 py-1.5"
            onClick={() => void onDownload()}
          >
            <Download size={16} aria-hidden />
            {t('messages.fileDownload')}
          </button>
          <button
            type="button"
            className="p-2 rounded-md text-[var(--tb-text-secondary)] hover:bg-[var(--tb-surface-muted)]"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <X size={20} aria-hidden />
          </button>
        </div>
      </div>

      <div className="relative z-10 flex-1 min-h-0 p-4 pointer-events-auto">
        <iframe
          title={fileName}
          src={fileUrl}
          className="w-full h-full min-h-[50vh] rounded-lg border border-[var(--tb-border)] bg-white"
        />
      </div>
    </div>,
    document.body
  );
}
