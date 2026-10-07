import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { formatInstallationDate } from '../../lib/installations/format';
import {
  createInstallationRepair,
  deleteInstallationRepair,
  updateInstallationRepair,
} from '../../lib/installations/installationService';
import type { InstallationDocument, InstallationRepair } from '../../lib/installations/types';
import { getInstallationDocumentUrl } from '../../lib/installations/installationDocumentService';
import TranslatableText from '../../taskboard/components/TranslatableText';
import RepairCommentsSection from './RepairCommentsSection';

interface InstallationRepairsSectionProps {
  installationId: string;
  repairs: InstallationRepair[];
  documents: InstallationDocument[];
  isAdmin: boolean;
}

function RepairEditor({
  installationId,
  initial,
  onCancel,
  onDone,
}: {
  installationId: string;
  initial?: InstallationRepair;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { t } = useTaskboardI18n();
  const [occurredOn, setOccurredOn] = useState(initial?.occurred_on ?? '');
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [resolved, setResolved] = useState(initial?.resolved ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (initial) {
        await updateInstallationRepair(initial.id, {
          occurred_on: occurredOn,
          summary,
          notes,
          resolved,
        });
      } else {
        await createInstallationRepair(installationId, {
          occurred_on: occurredOn,
          summary,
          notes,
          resolved,
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.admin.saveError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-[var(--tb-border)] p-4 space-y-3 bg-[var(--tb-bg)]"
    >
      <div>
        <label className="tb-field-label block mb-1">{t('projects.repair.date')}</label>
        <input
          type="date"
          required
          value={occurredOn}
          onChange={(e) => setOccurredOn(e.target.value)}
          className="field-input w-full text-sm"
        />
      </div>
      <div>
        <label className="tb-field-label block mb-1">{t('projects.repair.summary')}</label>
        <input
          type="text"
          required
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="field-input w-full text-sm"
        />
      </div>
      <div>
        <label className="tb-field-label block mb-1">{t('projects.repair.notes')}</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="field-input w-full text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-sm tb-text">
        <input
          type="checkbox"
          checked={resolved}
          onChange={(e) => setResolved(e.target.checked)}
          className="rounded border-[var(--tb-border)]"
        />
        {t('projects.detail.repairResolved')}
      </label>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="tb-btn-secondary text-sm">
          {t('common.cancel')}
        </button>
        <button type="submit" disabled={submitting} className="tb-btn-primary text-sm disabled:opacity-50">
          {submitting ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </form>
  );
}

function RepairPhotoStrip({ photos }: { photos: InstallationDocument[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    for (const photo of photos) {
      if (!photo.storage_path) continue;
      void getInstallationDocumentUrl(photo.storage_path).then((url) => {
        if (!cancelled) {
          setUrls((prev) => ({ ...prev, [photo.id]: url }));
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [photos]);

  if (photos.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2 mt-3">
      {photos.map((photo) => {
        const url = urls[photo.id];
        return (
          <li key={photo.id}>
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer">
                <img
                  src={url}
                  alt={photo.title || 'Bug photo'}
                  className="h-16 w-16 object-cover rounded-md border border-[var(--tb-border)]"
                />
              </a>
            ) : (
              <span className="text-xs tb-muted">{photo.title || '…'}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function InstallationRepairsSection({
  installationId,
  repairs,
  documents,
  isAdmin,
}: InstallationRepairsSectionProps) {
  const { t } = useTaskboardI18n();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const photosByRepair = useMemo(() => {
    const map = new Map<string, InstallationDocument[]>();
    for (const doc of documents) {
      if (doc.kind !== 'photo' || !doc.repair_id) continue;
      const list = map.get(doc.repair_id) ?? [];
      list.push(doc);
      map.set(doc.repair_id, list);
    }
    return map;
  }, [documents]);

  const handleDelete = async (repair: InstallationRepair) => {
    if (!window.confirm(t('projects.repair.deleteConfirm'))) return;
    setRemovingId(repair.id);
    try {
      await deleteInstallationRepair(repair.id);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {repairs.length === 0 && !isAdmin ? (
        <p className="text-sm tb-muted">{t('projects.detail.noRepairs')}</p>
      ) : (
        <ul className="space-y-4">
          {repairs.map((repair) =>
            editingId === repair.id ? (
              <li key={repair.id}>
                <RepairEditor
                  installationId={installationId}
                  initial={repair}
                  onCancel={() => setEditingId(null)}
                  onDone={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li
                key={repair.id}
                className="rounded-lg border border-[var(--tb-border)] p-4 space-y-2"
              >
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    {repair.kind === 'bug_report' ? (
                      <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-red-600/15 text-red-700">
                        {t('projects.bug.badge')}
                      </span>
                    ) : null}
                    <span className="text-sm tb-text font-medium">
                      <TranslatableText text={repair.summary} />
                    </span>
                  </div>
                  <span className="text-xs tb-muted shrink-0">
                    {formatInstallationDate(repair.occurred_on)}
                  </span>
                </div>

                {repair.notes ? (
                  <p className="text-sm tb-text-secondary whitespace-pre-wrap">
                    <TranslatableText text={repair.notes} multiline />
                  </p>
                ) : null}

                <p className="text-xs tb-muted">
                  {repair.resolved
                    ? t('projects.detail.repairResolved')
                    : t('projects.detail.repairOpen')}
                  {repair.reported_by ? (
                    <>
                      {' · '}
                      {t('projects.bug.reportedBy', { name: repair.reported_by })}
                    </>
                  ) : null}
                </p>

                <RepairPhotoStrip photos={photosByRepair.get(repair.id) ?? []} />

                {isAdmin ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingId(repair.id)}
                      className="text-xs tb-btn-secondary inline-flex items-center gap-1"
                    >
                      <Pencil size={12} />
                      {t('projects.admin.edit')}
                    </button>
                    <button
                      type="button"
                      disabled={removingId === repair.id}
                      onClick={() => void handleDelete(repair)}
                      className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      {t('common.remove')}
                    </button>
                  </div>
                ) : null}

                <RepairCommentsSection repairId={repair.id} />
              </li>
            ),
          )}
        </ul>
      )}

      {isAdmin && adding ? (
        <RepairEditor
          installationId={installationId}
          onCancel={() => setAdding(false)}
          onDone={() => setAdding(false)}
        />
      ) : null}

      {isAdmin && !adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="tb-btn-secondary inline-flex items-center gap-2 text-sm"
        >
          <Plus size={16} />
          {t('projects.repair.add')}
        </button>
      ) : null}
    </div>
  );
}
