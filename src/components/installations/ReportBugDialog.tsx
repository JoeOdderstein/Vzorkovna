import { FormEvent, useEffect, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { uploadInstallationDocument } from '../../lib/installations/installationDocumentService';
import {
  fetchNotifyRecipients,
  notifyBugReport,
  type NotifyRecipient,
} from '../../lib/installations/notifyBugReport';
import { createInstallationBugReport } from '../../lib/installations/installationService';

interface ReportBugDialogProps {
  open: boolean;
  installationId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

function todayIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ReportBugDialog({
  open,
  installationId,
  onClose,
  onSubmitted,
}: ReportBugDialogProps) {
  const { t } = useTaskboardI18n();
  const { username } = useTaskboardAuth();
  const { profile } = useUserProfile();
  const inputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [recipients, setRecipients] = useState<NotifyRecipient[]>([]);
  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reportedDate = todayIsoDate();

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setPhotos([]);
    setSelectedUsernames([]);
    setError('');
    setSubmitting(false);

    setLoadingRecipients(true);
    void fetchNotifyRecipients()
      .then(setRecipients)
      .catch(() => setRecipients([]))
      .finally(() => setLoadingRecipients(false));
  }, [open]);

  if (!open) return null;

  const toggleRecipient = (name: string) => {
    setSelectedUsernames((prev) =>
      prev.includes(name) ? prev.filter((u) => u !== name) : [...prev, name],
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username) {
      setError(t('projects.bug.loginRequired'));
      return;
    }
    if (!title.trim() || !description.trim()) {
      setError(t('projects.bug.requiredFields'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const repair = await createInstallationBugReport(installationId, {
        title: title.trim(),
        description: description.trim(),
        reportedBy: username,
        occurredOn: reportedDate,
      });

      for (const file of photos) {
        await uploadInstallationDocument(installationId, 'photo', file, repair.id);
      }

      if (selectedUsernames.length > 0) {
        try {
          await notifyBugReport({
            repairId: repair.id,
            installationId,
            notifyUsernames: selectedUsernames,
          });
        } catch (notifyErr) {
          console.warn('Bug saved but email notify failed:', notifyErr);
        }
      }

      onSubmitted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.bug.submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  const reporterLabel =
    profile?.board_name?.trim() || profile?.username || username || '—';

  return (
    <div className="taskboard fixed inset-0 z-[90] flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 tb-overlay" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-labelledby="report-bug-title"
        className="relative w-full max-w-lg tb-remote-inst-card shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 border-b border-[var(--tb-border)] px-6 py-4 flex items-center justify-between bg-[var(--tb-bg)]">
          <h2 id="report-bug-title" className="tb-heading">
            {t('projects.bug.dialogTitle')}
          </h2>
          <button type="button" onClick={onClose} className="tb-muted hover:text-[var(--tb-text)]" aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          <div>
            <label className="tb-field-label block mb-1">{t('projects.bug.date')}</label>
            <p className="text-sm tb-text">{formatDisplayDate(reportedDate)}</p>
          </div>

          <div>
            <label className="tb-field-label block mb-1">{t('projects.bug.reporter')}</label>
            <p className="text-sm tb-text">{reporterLabel}</p>
          </div>

          <div>
            <label htmlFor="bug-title" className="tb-field-label block mb-2">
              {t('projects.bug.titleLabel')}
            </label>
            <input
              id="bug-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="field-input w-full"
              required
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="bug-description" className="tb-field-label block mb-2">
              {t('projects.bug.descriptionLabel')}
            </label>
            <textarea
              id="bug-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="field-input w-full"
              required
            />
          </div>

          <div>
            <label className="tb-field-label block mb-2">{t('projects.bug.photos')}</label>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                setPhotos((prev) => [...prev, ...files]);
                if (inputRef.current) inputRef.current.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="tb-btn-secondary inline-flex items-center gap-2 text-sm"
            >
              <Upload size={16} />
              {t('projects.admin.upload')}
            </button>
            {photos.length > 0 ? (
              <ul className="mt-2 text-xs tb-muted space-y-1">
                {photos.map((file) => (
                  <li key={`${file.name}-${file.size}`}>{file.name}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div>
            <label className="tb-field-label block mb-2">{t('projects.bug.notifyLabel')}</label>
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

          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="tb-btn-secondary">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={submitting} className="tb-btn-primary disabled:opacity-50">
              {submitting ? t('projects.bug.submitting') : t('projects.bug.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatDisplayDate(iso: string) {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
