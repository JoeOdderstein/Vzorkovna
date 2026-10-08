import { FormEvent, useEffect, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { DEFAULT_INVOICE_NOTIFY_USERNAME } from '../../lib/invoices/constants';
import { notifyInvoiceUpload } from '../../lib/invoices/notifyInvoiceUpload';
import { uploadInvoicePdf, type InvoiceRecord } from '../../lib/invoices/invoiceService';
import {
  fetchNotifyRecipients,
  type NotifyRecipient,
} from '../../lib/installations/notifyBugReport';

interface UploadInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  onUploaded: (invoice: InvoiceRecord) => void;
}

export default function UploadInvoiceDialog({
  open,
  onClose,
  onUploaded,
}: UploadInvoiceDialogProps) {
  const { t } = useTaskboardI18n();
  const { username } = useTaskboardAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [recipients, setRecipients] = useState<NotifyRecipient[]>([]);
  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([
    DEFAULT_INVOICE_NOTIFY_USERNAME,
  ]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notifyWarning, setNotifyWarning] = useState('');

  useEffect(() => {
    if (!open) return;

    setFile(null);
    setSelectedUsernames([DEFAULT_INVOICE_NOTIFY_USERNAME]);
    setError('');
    setNotifyWarning('');
    setSubmitting(false);

    let cancelled = false;
    setLoadingRecipients(true);
    void fetchNotifyRecipients()
      .then((rows) => {
        if (cancelled) return;
        setRecipients(rows);
      })
      .catch(() => {
        if (!cancelled) setRecipients([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRecipients(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !submitting && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose, submitting]);

  if (!open) return null;

  const toggleRecipient = (name: string) => {
    setSelectedUsernames((prev) =>
      prev.includes(name) ? prev.filter((u) => u !== name) : [...prev, name],
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username) {
      setError(t('invoices.uploadLoginRequired'));
      return;
    }
    if (!file) {
      setError(t('invoices.uploadFileRequired'));
      return;
    }

    setSubmitting(true);
    setError('');
    setNotifyWarning('');

    try {
      const created = await uploadInvoicePdf(file, username);

      const notifyUsernames = [...new Set(selectedUsernames.map((u) => u.trim().toLowerCase()))].filter(
        Boolean,
      );

      if (notifyUsernames.length > 0) {
        try {
          await notifyInvoiceUpload({ invoiceId: created.id, notifyUsernames });
        } catch (notifyErr) {
          console.warn('Invoice saved but email notify failed:', notifyErr);
          setNotifyWarning(t('invoices.uploadNotifyFailed'));
        }
      }

      onUploaded(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invoices.uploadFailed'));
    } finally {
      setSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="taskboard fixed inset-0 z-[85] flex items-center justify-center px-6">
      <div className="absolute inset-0 tb-overlay" onClick={submitting ? undefined : onClose} aria-hidden />
      <div
        role="dialog"
        aria-labelledby="upload-invoice-title"
        className="relative w-full max-w-lg tb-remote-inst-card shadow-xl max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 id="upload-invoice-title" className="tb-heading text-lg">
            {t('invoices.uploadDialogTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="tb-muted hover:text-[var(--tb-text)] disabled:opacity-50"
            aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="tb-field-label block mb-2">{t('projects.bug.notifyLabel')}</label>
            <p className="text-xs tb-muted mb-2">{t('invoices.uploadNotifyHint')}</p>
            {loadingRecipients ? (
              <p className="text-sm tb-muted">{t('common.loading')}</p>
            ) : recipients.length === 0 ? (
              <p className="text-sm tb-muted">{t('projects.bug.noRecipients')}</p>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--tb-border)] p-3 space-y-2">
                {recipients.map((person) => (
                  <label
                    key={person.username}
                    className="flex items-center gap-2 text-sm tb-text cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsernames.includes(person.username)}
                      onChange={() => toggleRecipient(person.username)}
                      className="rounded border-[var(--tb-border)]"
                    />
                    <span>
                      {person.board_name}
                      <span className="tb-muted text-xs ml-1">({person.email})</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="tb-field-label block mb-2">{t('invoices.uploadFileLabel')}</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                setFile(picked);
                setError('');
              }}
            />
            <button
              type="button"
              className="tb-btn-secondary inline-flex items-center gap-2 text-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} aria-hidden />
              {t('invoices.choosePdf')}
            </button>
            {file ? (
              <p className="text-sm tb-text mt-2 truncate">{file.name}</p>
            ) : (
              <p className="text-xs tb-muted mt-2">{t('invoices.uploadHint')}</p>
            )}
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {notifyWarning ? <p className="text-sm text-amber-700">{notifyWarning}</p> : null}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={submitting} className="tb-btn-secondary">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={submitting || !file} className="tb-btn-primary disabled:opacity-50">
              {submitting ? t('invoices.uploading') : t('invoices.uploadConfirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
