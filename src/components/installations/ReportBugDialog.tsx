import { FormEvent, useEffect, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { defaultBoardNameForUsername } from '../../lib/taskboard/boardNameUtils';
import {
  BUG_FREQUENCY_ORDER,
  BUG_INSTALLATION_ORDER,
  BUG_PART_ORDER,
  BUG_USABILITY_ORDER,
  emptyBugReportForm,
  guessInstallationKeyFromName,
  type BugReportFormV1,
} from '../../lib/installations/bugReportForm';
import {
  deleteInstallationDocument,
  getInstallationDocumentUrl,
  uploadInstallationDocument,
} from '../../lib/installations/installationDocumentService';
import {
  fetchNotifyRecipients,
  notifyBugReport,
  type NotifyRecipient,
} from '../../lib/installations/notifyBugReport';
import {
  createInstallationBugReport,
  updateInstallationBugReport,
} from '../../lib/installations/installationService';
import type { InstallationDocument, InstallationRepair } from '../../lib/installations/types';

interface ReportBugDialogProps {
  open: boolean;
  installationId: string;
  /** Pre-select installation question from project page context. */
  installationName?: string;
  onClose: () => void;
  onSubmitted: () => void;
  repair?: InstallationRepair | null;
  existingPhotos?: InstallationDocument[];
}

const EMPTY_PHOTOS: InstallationDocument[] = [];

export default function ReportBugDialog({
  open,
  installationId,
  installationName = '',
  onClose,
  onSubmitted,
  repair = null,
  existingPhotos = EMPTY_PHOTOS,
}: ReportBugDialogProps) {
  const { t } = useTaskboardI18n();
  const { username } = useTaskboardAuth();
  const { profile } = useUserProfile();
  const inputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<BugReportFormV1>(() => emptyBugReportForm());
  const [photos, setPhotos] = useState<File[]>([]);
  const [recipients, setRecipients] = useState<NotifyRecipient[]>([]);
  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [attachedPhotos, setAttachedPhotos] = useState<InstallationDocument[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [removingPhotoId, setRemovingPhotoId] = useState<string | null>(null);

  const isEdit = Boolean(repair);

  const patchForm = (patch: Partial<BugReportFormV1>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  useEffect(() => {
    if (!open) return;

    const guessed = installationName ? guessInstallationKeyFromName(installationName) : null;
    const fromRepair = repair?.bug_form ?? null;

    if (fromRepair) {
      setForm(fromRepair);
    } else if (repair) {
      setForm({
        ...emptyBugReportForm({
          installation: guessed ?? 'other',
          occurredDate: repair.occurred_on,
        }),
        installationOther:
          guessed || !installationName.trim() ? '' : installationName.trim(),
        expectedVsActual: repair.notes ?? '',
      });
    } else {
      const initial = emptyBugReportForm({
        installation: guessed ?? 'other',
      });
      if (!guessed && installationName.trim()) {
        initial.installation = 'other';
        initial.installationOther = installationName.trim();
      }
      setForm(initial);
    }

    setPhotos([]);
    setSelectedUsernames(repair?.notify_usernames ?? []);
    setAttachedPhotos(existingPhotos);
    setPhotoUrls({});
    setError('');
    setSubmitting(false);

    let cancelled = false;
    setLoadingRecipients(true);
    void fetchNotifyRecipients()
      .then((rows) => {
        if (!cancelled) setRecipients(rows);
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
  }, [open, installationId, repair?.id, installationName]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    for (const photo of attachedPhotos) {
      if (!photo.storage_path) continue;
      void getInstallationDocumentUrl(photo.storage_path).then((url) => {
        if (!cancelled) {
          setPhotoUrls((prev) => ({ ...prev, [photo.id]: url }));
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [open, attachedPhotos]);

  if (!open) return null;

  const toggleRecipient = (name: string) => {
    setSelectedUsernames((prev) =>
      prev.includes(name) ? prev.filter((u) => u !== name) : [...prev, name],
    );
  };

  const reporterDisplayName =
    profile?.board_name?.trim() ||
    (username ? defaultBoardNameForUsername(username) : '') ||
    username ||
    '—';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username) {
      setError(t('projects.bug.loginRequired'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const previousNotify = repair?.notify_usernames ?? [];

      if (isEdit && repair) {
        await updateInstallationBugReport(repair.id, {
          form,
          reporterDisplayName,
          notifyUsernames: selectedUsernames,
        });

        for (const file of photos) {
          await uploadInstallationDocument(installationId, 'photo', file, repair.id);
        }

        const newlyNotified = selectedUsernames.filter((u) => !previousNotify.includes(u));
        if (newlyNotified.length > 0) {
          try {
            await notifyBugReport({
              repairId: repair.id,
              installationId,
              notifyUsernames: newlyNotified,
            });
          } catch (notifyErr) {
            console.warn('Bug saved but email notify failed:', notifyErr);
          }
        }
      } else {
        const created = await createInstallationBugReport(installationId, {
          form,
          reportedBy: username,
          reporterDisplayName,
          notifyUsernames: selectedUsernames,
        });

        for (const file of photos) {
          await uploadInstallationDocument(installationId, 'photo', file, created.id);
        }

        if (selectedUsernames.length > 0) {
          try {
            await notifyBugReport({
              repairId: created.id,
              installationId,
              notifyUsernames: selectedUsernames,
            });
          } catch (notifyErr) {
            console.warn('Bug saved but email notify failed:', notifyErr);
          }
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

  const removeAttachedPhoto = async (photo: InstallationDocument) => {
    setRemovingPhotoId(photo.id);
    try {
      await deleteInstallationDocument(photo);
      setAttachedPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.bug.photoRemoveError'));
    } finally {
      setRemovingPhotoId(null);
    }
  };

  const fieldsetClass = 'space-y-2 border-0 p-0 m-0';
  const legendClass = 'tb-field-label block mb-2 font-semibold';
  const hintClass = 'text-xs tb-muted mb-2';

  return (
    <div className="taskboard fixed inset-0 z-[90] flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 tb-overlay" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-labelledby="report-bug-title"
        className="relative w-full max-w-2xl tb-remote-inst-card shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-[var(--tb-border)] px-6 py-4 flex items-center justify-between bg-[var(--tb-bg)]">
          <h2 id="report-bug-title" className="tb-heading">
            {isEdit ? t('projects.bug.editDialogTitle') : t('projects.bug.dialogTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="tb-muted hover:text-[var(--tb-text)]"
            aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
          <fieldset className={fieldsetClass}>
            <legend className={legendClass}>{t('projects.bug.form.q1Installation')}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {BUG_INSTALLATION_ORDER.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="bug-installation"
                    checked={form.installation === key}
                    onChange={() => patchForm({ installation: key })}
                    className="border-[var(--tb-border)]"
                  />
                  <span>{t(`projects.bug.form.installation.${key}`)}</span>
                </label>
              ))}
            </div>
            {form.installation === 'other' ? (
              <input
                type="text"
                value={form.installationOther}
                onChange={(e) => patchForm({ installationOther: e.target.value })}
                className="field-input w-full mt-2 text-sm"
                placeholder={t('projects.bug.form.installationOtherPlaceholder')}
                required
              />
            ) : null}
          </fieldset>

          <fieldset className={fieldsetClass}>
            <legend className={legendClass}>{t('projects.bug.form.q2Part')}</legend>
            <p className={hintClass}>{t('projects.bug.form.q2PartHint')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {BUG_PART_ORDER.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="bug-part"
                    checked={form.part === key}
                    onChange={() => patchForm({ part: key })}
                    className="border-[var(--tb-border)]"
                  />
                  <span>{t(`projects.bug.form.part.${key}`)}</span>
                </label>
              ))}
            </div>
            {form.part === 'sensor' ? (
              <input
                type="text"
                value={form.partSensorDetail}
                onChange={(e) => patchForm({ partSensorDetail: e.target.value })}
                className="field-input w-full mt-2 text-sm"
                placeholder={t('projects.bug.form.sensorPlaceholder')}
                required
              />
            ) : null}
            {form.part === 'other' ? (
              <input
                type="text"
                value={form.partOther}
                onChange={(e) => patchForm({ partOther: e.target.value })}
                className="field-input w-full mt-2 text-sm"
                placeholder={t('projects.bug.form.partOtherPlaceholder')}
                required
              />
            ) : null}
          </fieldset>

          <fieldset className={fieldsetClass}>
            <legend className={legendClass}>{t('projects.bug.form.q3When')}</legend>
            <div className="flex flex-wrap gap-3">
              <label className="text-xs tb-muted flex flex-col gap-1">
                {t('projects.bug.form.dateLabel')}
                <input
                  type="date"
                  required
                  value={form.occurredDate}
                  onChange={(e) => patchForm({ occurredDate: e.target.value })}
                  className="field-input text-sm"
                />
              </label>
              <label className="text-xs tb-muted flex flex-col gap-1">
                {t('projects.bug.form.timeLabel')}
                <input
                  type="time"
                  value={form.occurredTime}
                  onChange={(e) => patchForm({ occurredTime: e.target.value })}
                  className="field-input text-sm"
                />
              </label>
            </div>
            <textarea
              value={form.durationText}
              onChange={(e) => patchForm({ durationText: e.target.value })}
              rows={2}
              required
              className="field-input w-full mt-2 text-sm"
              placeholder={t('projects.bug.form.durationPlaceholder')}
            />
          </fieldset>

          <fieldset className={fieldsetClass}>
            <legend className={legendClass}>{t('projects.bug.form.q4Usability')}</legend>
            <div className="space-y-2">
              {BUG_USABILITY_ORDER.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="bug-usability"
                    checked={form.usability === key}
                    onChange={() => patchForm({ usability: key })}
                    className="border-[var(--tb-border)]"
                  />
                  <span>{t(`projects.bug.form.usability.${key}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="bug-expected" className={legendClass}>
              {t('projects.bug.form.q5Expected')}
            </label>
            <p className={hintClass}>{t('projects.bug.form.q5Hint')}</p>
            <textarea
              id="bug-expected"
              value={form.expectedVsActual}
              onChange={(e) => patchForm({ expectedVsActual: e.target.value })}
              rows={5}
              required
              className="field-input w-full text-sm"
            />
          </div>

          <div>
            <label htmlFor="bug-context" className={legendClass}>
              {t('projects.bug.form.q6Context')}
            </label>
            <textarea
              id="bug-context"
              value={form.context}
              onChange={(e) => patchForm({ context: e.target.value })}
              rows={3}
              className="field-input w-full text-sm"
            />
          </div>

          <fieldset className={fieldsetClass}>
            <legend className={legendClass}>{t('projects.bug.form.q7Frequency')}</legend>
            <div className="space-y-2">
              {BUG_FREQUENCY_ORDER.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="bug-frequency"
                    checked={form.frequency === key}
                    onChange={() => patchForm({ frequency: key })}
                    className="border-[var(--tb-border)]"
                  />
                  <span>{t(`projects.bug.form.frequency.${key}`)}</span>
                </label>
              ))}
            </div>
            {form.frequency !== 'first_time' ? (
              <input
                type="text"
                value={form.frequencySince}
                onChange={(e) => patchForm({ frequencySince: e.target.value })}
                className="field-input w-full mt-2 text-sm"
                placeholder={t('projects.bug.form.frequencySincePlaceholder')}
                required
              />
            ) : null}
          </fieldset>

          <div>
            <label htmlFor="bug-changes" className={legendClass}>
              {t('projects.bug.form.q8Changes')}
            </label>
            <textarea
              id="bug-changes"
              value={form.recentChanges}
              onChange={(e) => patchForm({ recentChanges: e.target.value })}
              rows={3}
              className="field-input w-full text-sm"
            />
          </div>

          <div>
            <label htmlFor="bug-tried" className={legendClass}>
              {t('projects.bug.form.q9Tried')}
            </label>
            <textarea
              id="bug-tried"
              value={form.triedAlready}
              onChange={(e) => patchForm({ triedAlready: e.target.value })}
              rows={2}
              className="field-input w-full text-sm"
            />
          </div>

          <div>
            <label className={legendClass}>{t('projects.bug.form.q10Media')}</label>
            <p className={hintClass}>{t('projects.bug.form.q10Hint')}</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,.jpg,.jpeg,.png,.webp,.mp4,.mov,.webm"
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
              {t('projects.bug.form.uploadMedia')}
            </button>
            {attachedPhotos.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {attachedPhotos.map((photo) => {
                  const url = photoUrls[photo.id];
                  return (
                    <li key={photo.id} className="relative">
                      {url ? (
                        <img
                          src={url}
                          alt={photo.title || 'Bug media'}
                          className="h-16 w-16 object-cover rounded-md border border-[var(--tb-border)]"
                        />
                      ) : (
                        <span className="text-xs tb-muted block h-16 w-16 px-1 truncate border rounded-md">
                          {photo.title || '…'}
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={removingPhotoId === photo.id}
                        onClick={() => void removeAttachedPhoto(photo)}
                        className="absolute -top-1.5 -right-1.5 rounded-full bg-[var(--tb-bg)] border border-[var(--tb-border)] p-0.5 text-red-600 hover:text-red-800 disabled:opacity-50"
                        aria-label={t('common.remove')}
                      >
                        <X size={12} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {photos.length > 0 ? (
              <ul className="mt-2 text-xs tb-muted space-y-1">
                {photos.map((file) => (
                  <li key={`${file.name}-${file.size}`}>{file.name}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <fieldset className={fieldsetClass}>
            <legend className={legendClass}>{t('projects.bug.form.q11Contact')}</legend>
            <p className="text-sm tb-text mb-2">
              {t('projects.bug.form.filledInBy')}: <strong>{reporterDisplayName}</strong>
            </p>
            <label htmlFor="bug-contact" className="sr-only">
              {t('projects.bug.form.contactForGus')}
            </label>
            <input
              id="bug-contact"
              type="text"
              required
              value={form.contactForGus}
              onChange={(e) => patchForm({ contactForGus: e.target.value })}
              className="field-input w-full text-sm"
              placeholder={t('projects.bug.form.contactForGusPlaceholder')}
            />
          </fieldset>

          <div>
            <label className={legendClass}>{t('projects.bug.notifyLabel')}</label>
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

          <div className="flex justify-end gap-3 pt-2 sticky bottom-0 bg-[var(--tb-bg)] pb-1">
            <button type="button" onClick={onClose} className="tb-btn-secondary">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={submitting} className="tb-btn-primary disabled:opacity-50">
              {submitting
                ? t('common.saving')
                : isEdit
                  ? t('projects.bug.saveChanges')
                  : t('projects.bug.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
