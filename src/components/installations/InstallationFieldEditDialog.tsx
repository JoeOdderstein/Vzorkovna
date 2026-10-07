import { FormEvent, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import {
  INSTALLATION_LIFECYCLE_LABELS,
  INSTALLATION_LIFECYCLE_STATUSES,
  INSTALLATION_LOCATION_LABELS,
  INSTALLATION_LOCATIONS,
} from '../../lib/installations/constants';
import type { InstallationRecord } from '../../lib/installations/types';
import {
  translateInstallationLifecycle,
  translateInstallationLocation,
} from '../../lib/taskboard/i18n/messages';

export type InstallationEditableField =
  | 'name'
  | 'location'
  | 'lifecycle_status'
  | 'responsible_person'
  | 'last_inspection_date'
  | 'next_maintenance_date'
  | 'revizni_zprava_available'
  | 'remote_url';

interface InstallationFieldEditDialogProps {
  open: boolean;
  field: InstallationEditableField | null;
  installation: InstallationRecord;
  onClose: () => void;
  onSave: (field: InstallationEditableField, value: string | boolean) => Promise<void>;
}

function fieldLabel(
  field: InstallationEditableField,
  t: (key: import('../../lib/taskboard/i18n/messages').MessageKey) => string,
) {
  switch (field) {
    case 'name':
      return t('projects.detail.meta.name');
    case 'location':
      return t('projects.detail.meta.location');
    case 'lifecycle_status':
      return t('projects.detail.meta.currentStatus');
    case 'responsible_person':
      return t('projects.detail.meta.responsible');
    case 'last_inspection_date':
      return t('projects.detail.meta.lastInspection');
    case 'next_maintenance_date':
      return t('projects.detail.meta.nextMaintenance');
    case 'revizni_zprava_available':
      return t('projects.detail.meta.revizniZprava');
    case 'remote_url':
      return t('projects.detail.meta.remoteUrl');
  }
}

export default function InstallationFieldEditDialog({
  open,
  field,
  installation,
  onClose,
  onSave,
}: InstallationFieldEditDialogProps) {
  const { t, locale } = useTaskboardI18n();
  const [value, setValue] = useState('');
  const [boolValue, setBoolValue] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !field) return;
    setError('');
    setSubmitting(false);
    switch (field) {
      case 'name':
        setValue(installation.name);
        break;
      case 'location':
        setValue(installation.location);
        break;
      case 'lifecycle_status':
        setValue(installation.lifecycle_status);
        break;
      case 'responsible_person':
        setValue(installation.responsible_person ?? '');
        break;
      case 'last_inspection_date':
        setValue(installation.last_inspection_date ?? '');
        break;
      case 'next_maintenance_date':
        setValue(installation.next_maintenance_date ?? '');
        break;
      case 'revizni_zprava_available':
        setBoolValue(installation.revizni_zprava_available);
        break;
      case 'remote_url':
        setValue(installation.remote_url ?? '');
        break;
    }
  }, [open, field, installation]);

  if (!open || !field) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (field === 'revizni_zprava_available') {
        await onSave(field, boolValue);
      } else {
        await onSave(field, value);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.admin.saveError'));
    } finally {
      setSubmitting(false);
    }
  };

  const title = fieldLabel(field, t);

  return (
    <div className="taskboard fixed inset-0 z-[85] flex items-center justify-center px-6">
      <div className="absolute inset-0 tb-overlay" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-labelledby="installation-field-edit-title"
        className="relative w-full max-w-md tb-remote-inst-card shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 id="installation-field-edit-title" className="tb-heading text-lg">
            {t('projects.admin.editField', { field: title })}
          </h2>
          <button type="button" onClick={onClose} className="tb-muted hover:text-[var(--tb-text)]" aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {field === 'name' || field === 'responsible_person' || field === 'remote_url' ? (
            <input
              type={field === 'remote_url' ? 'url' : 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="field-input w-full"
              autoFocus
            />
          ) : null}

          {field === 'location' ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="field-input w-full"
            >
              {INSTALLATION_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {translateInstallationLocation(locale, loc, INSTALLATION_LOCATION_LABELS[loc])}
                </option>
              ))}
            </select>
          ) : null}

          {field === 'lifecycle_status' ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="field-input w-full"
            >
              {INSTALLATION_LIFECYCLE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {translateInstallationLifecycle(
                    locale,
                    status,
                    INSTALLATION_LIFECYCLE_LABELS[status],
                  )}
                </option>
              ))}
            </select>
          ) : null}

          {field === 'last_inspection_date' || field === 'next_maintenance_date' ? (
            <input
              type="date"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="field-input w-full"
            />
          ) : null}

          {field === 'revizni_zprava_available' ? (
            <label className="flex items-center gap-2 text-sm tb-text cursor-pointer">
              <input
                type="checkbox"
                checked={boolValue}
                onChange={(e) => setBoolValue(e.target.checked)}
                className="rounded border-[var(--tb-border)]"
              />
              {t('projects.detail.onFile')}
            </label>
          ) : null}

          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="tb-btn-secondary">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={submitting} className="tb-btn-primary disabled:opacity-50">
              {submitting ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
