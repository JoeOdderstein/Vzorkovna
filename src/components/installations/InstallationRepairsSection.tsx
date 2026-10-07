import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Plus } from 'lucide-react';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
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
import TaskPhotoLightbox from '../../taskboard/components/TaskPhotoLightbox';
import RepairCommentsSection from './RepairCommentsSection';
import ReportBugDialog from './ReportBugDialog';

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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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

  const openLightbox = useCallback(
    (photoId: string) => {
      const index = photos.findIndex((photo) => photo.id === photoId);
      if (index >= 0 && urls[photoId]) setLightboxIndex(index);
    },
    [photos, urls],
  );

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const lightboxPhoto =
    lightboxIndex != null && lightboxIndex >= 0 && lightboxIndex < photos.length
      ? photos[lightboxIndex]
      : null;
  const lightboxUrl = lightboxPhoto ? urls[lightboxPhoto.id] : null;

  if (photos.length === 0) return null;

  return (
    <>
      <ul className="flex flex-wrap gap-2 mt-2 list-none m-0 p-0">
        {photos.map((photo) => {
          const url = urls[photo.id];
          return (
            <li key={photo.id} className="shrink-0">
              {url ? (
                <button
                  type="button"
                  onClick={() => openLightbox(photo.id)}
                  className="group relative rounded-md border border-[var(--tb-border)] overflow-hidden bg-[var(--tb-bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tb-accent)]"
                  title={photo.title || 'View photo'}
                >
                  <img
                    src={url}
                    alt={photo.title || 'Bug photo'}
                    className="block h-20 w-20 object-cover"
                  />
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/50 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    View
                  </span>
                </button>
              ) : (
                <span className="flex h-20 w-20 items-center justify-center text-xs tb-muted border border-[var(--tb-border)] rounded-md">
                  {photo.title || '…'}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {lightboxPhoto && lightboxUrl ? (
        <TaskPhotoLightbox
          imageUrl={lightboxUrl}
          fileName={lightboxPhoto.title || 'Bug photo'}
          onClose={closeLightbox}
          hasPrevious={lightboxIndex != null && lightboxIndex > 0}
          hasNext={lightboxIndex != null && lightboxIndex < photos.length - 1}
          onPrevious={() =>
            setLightboxIndex((i) => (i != null && i > 0 ? i - 1 : i))
          }
          onNext={() =>
            setLightboxIndex((i) =>
              i != null && i < photos.length - 1 ? i + 1 : i,
            )
          }
        />
      ) : null}
    </>
  );
}

function sortRepairs(list: InstallationRepair[]): InstallationRepair[] {
  return [...list].sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    return b.occurred_on.localeCompare(a.occurred_on);
  });
}

export default function InstallationRepairsSection({
  installationId,
  repairs,
  documents,
  isAdmin,
}: InstallationRepairsSectionProps) {
  const { t } = useTaskboardI18n();
  const { authenticated } = useTaskboardAuth();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [expandedResolvedIds, setExpandedResolvedIds] = useState<Set<string>>(() => new Set());
  const [editingBug, setEditingBug] = useState<InstallationRepair | null>(null);

  const sortedRepairs = useMemo(() => sortRepairs(repairs), [repairs]);

  const toggleResolvedExpanded = (repairId: string) => {
    setExpandedResolvedIds((prev) => {
      const next = new Set(prev);
      if (next.has(repairId)) next.delete(repairId);
      else next.add(repairId);
      return next;
    });
  };

  const setRepairResolved = async (repair: InstallationRepair, resolved: boolean) => {
    setResolvingId(repair.id);
    try {
      await updateInstallationRepair(repair.id, { resolved });
      if (resolved) {
        setExpandedResolvedIds((prev) => {
          const next = new Set(prev);
          next.delete(repair.id);
          return next;
        });
      }
    } finally {
      setResolvingId(null);
    }
  };

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
        <ul className="space-y-3">
          {sortedRepairs.map((repair) => {
            if (editingId === repair.id && repair.kind !== 'bug_report') {
              return (
                <li key={repair.id}>
                  <RepairEditor
                    installationId={installationId}
                    initial={repair}
                    onCancel={() => setEditingId(null)}
                    onDone={() => setEditingId(null)}
                  />
                </li>
              );
            }

            const isCompactResolved = repair.resolved && !expandedResolvedIds.has(repair.id);

            if (isCompactResolved) {
              return (
                <li
                  key={repair.id}
                  className="rounded-md border border-[var(--tb-border)] px-3 py-2 opacity-80"
                >
                  <div className="flex flex-wrap items-center gap-2 justify-between gap-y-1">
                    <button
                      type="button"
                      onClick={() => toggleResolvedExpanded(repair.id)}
                      className="flex items-center gap-1.5 min-w-0 text-left text-xs tb-text font-medium hover:opacity-90"
                    >
                      <ChevronDown size={14} className="shrink-0 tb-muted" aria-hidden />
                      <span className="truncate min-w-0">
                        <TranslatableText text={repair.summary} />
                      </span>
                      <span className="text-[10px] tb-muted font-normal shrink-0">
                        {formatInstallationDate(repair.occurred_on)}
                      </span>
                    </button>
                    <span className="text-[10px] tb-muted uppercase tracking-wide shrink-0">
                      {t('projects.detail.repairResolved')}
                    </span>
                  </div>
                </li>
              );
            }

            const isActiveBug = repair.kind === 'bug_report' && !repair.resolved;
            const headerActions = (
              <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                {repair.kind === 'bug_report' && authenticated && !repair.resolved ? (
                  <button
                    type="button"
                    disabled={resolvingId === repair.id}
                    onClick={() => void setRepairResolved(repair, true)}
                    className="text-[11px] tb-btn-primary py-1 px-2.5 whitespace-nowrap disabled:opacity-50"
                  >
                    {t('projects.bug.markResolved')}
                  </button>
                ) : null}
                {repair.resolved ? (
                  <button
                    type="button"
                    onClick={() => toggleResolvedExpanded(repair.id)}
                    className="text-[11px] tb-btn-secondary inline-flex items-center gap-1 py-1 px-2"
                  >
                    <ChevronUp size={12} />
                    {t('projects.bug.hideDetails')}
                  </button>
                ) : null}
                {repair.kind === 'bug_report' && authenticated && repair.resolved ? (
                  <>
                    <button
                      type="button"
                      disabled={resolvingId === repair.id}
                      onClick={() => void setRepairResolved(repair, false)}
                      className="text-[11px] tb-btn-secondary py-1 px-2 disabled:opacity-50"
                    >
                      {t('projects.bug.reopen')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingBug(repair)}
                      className="text-[11px] tb-btn-secondary inline-flex items-center gap-1 py-1 px-2"
                    >
                      <Pencil size={12} />
                      {t('projects.admin.edit')}
                    </button>
                  </>
                ) : null}
                {repair.kind === 'bug_report' && authenticated && !repair.resolved ? (
                  <button
                    type="button"
                    onClick={() => setEditingBug(repair)}
                    className="text-[11px] tb-btn-secondary inline-flex items-center gap-1 py-1 px-2"
                  >
                    <Pencil size={12} />
                    {t('projects.admin.edit')}
                  </button>
                ) : null}
                {isAdmin && repair.kind !== 'bug_report' ? (
                  <button
                    type="button"
                    onClick={() => setEditingId(repair.id)}
                    className="text-[11px] tb-btn-secondary inline-flex items-center gap-1 py-1 px-2"
                    title={t('projects.admin.edit')}
                  >
                    <Pencil size={12} />
                    <span className="sr-only">{t('projects.admin.edit')}</span>
                  </button>
                ) : null}
                {isAdmin ? (
                  <button
                    type="button"
                    disabled={removingId === repair.id}
                    onClick={() => void handleDelete(repair)}
                    className="text-[11px] text-red-600 hover:text-red-800 py-1 px-1 disabled:opacity-50"
                  >
                    {t('common.remove')}
                  </button>
                ) : null}
              </div>
            );

            return (
              <li
                key={repair.id}
                className={`rounded-lg border border-[var(--tb-border)] ${
                  isActiveBug ? 'p-3 space-y-1.5' : repair.resolved ? 'p-3 space-y-2 opacity-90' : 'p-4 space-y-2'
                }`}
              >
                <div className="flex items-start gap-3 justify-between">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      {repair.kind === 'bug_report' ? (
                        <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-red-600/15 text-red-700 shrink-0">
                          {t('projects.bug.badge')}
                        </span>
                      ) : null}
                      <span className="text-sm tb-text font-medium leading-snug">
                        <TranslatableText text={repair.summary} />
                      </span>
                    </div>
                    <p className="text-[11px] tb-muted leading-tight">
                      {formatInstallationDate(repair.occurred_on)}
                      {' · '}
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
                  </div>
                  {headerActions}
                </div>

                {repair.notes ? (
                  <p
                    className={`tb-text-secondary whitespace-pre-wrap leading-snug ${
                      isActiveBug ? 'text-xs pt-0.5' : 'text-sm'
                    }`}
                  >
                    <TranslatableText text={repair.notes} multiline />
                  </p>
                ) : null}

                <RepairPhotoStrip photos={photosByRepair.get(repair.id) ?? []} />

                <RepairCommentsSection
                  repairId={repair.id}
                  installationId={installationId}
                  notifyUsernames={repair.notify_usernames}
                  compact={isActiveBug}
                />
              </li>
            );
          })}
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

      <ReportBugDialog
        open={editingBug !== null}
        installationId={installationId}
        repair={editingBug}
        existingPhotos={editingBug ? (photosByRepair.get(editingBug.id) ?? []) : []}
        onClose={() => setEditingBug(null)}
        onSubmitted={() => setEditingBug(null)}
      />
    </div>
  );
}
