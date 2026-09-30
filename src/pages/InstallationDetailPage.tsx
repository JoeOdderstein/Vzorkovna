import { useState, type ReactNode } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import TechnicalDocumentationSection from '../components/installations/TechnicalDocumentationSection';
import { useTaskboardAuth } from '../context/TaskboardAuthContext';
import { useInstallation } from '../hooks/useInstallations';
import { useTaskboardI18n } from '../hooks/useTaskboardI18n';
import {
  INSTALLATION_LIFECYCLE_LABELS,
  INSTALLATION_LIFECYCLE_STATUSES,
  INSTALLATION_LOCATION_LABELS,
  lifecycleStatusLightClass,
  PI_CONNECT_POPUP_INSTALLATION_ID,
} from '../lib/installations/constants';
import { updateInstallationLifecycleStatus } from '../lib/installations/installationService';
import type { InstallationLifecycleStatus } from '../lib/installations/types';
import { formatInstallationDate } from '../lib/installations/format';
import type { InstallationDocumentKind, InstallationRecord } from '../lib/installations/types';
import { PROJECTS_PATH } from '../lib/taskboard/driveConstants';
import {
  translateInstallationLifecycle,
  translateInstallationLocation,
} from '../lib/taskboard/i18n/messages';
import { openRemotePopupWindow } from '../lib/taskboard/openRemotePopup';
import TranslatableText from '../taskboard/components/TranslatableText';

function documentsByKind(
  documents: InstallationRecord['documents'],
  kind: InstallationDocumentKind,
) {
  return documents.filter((document) => document.kind === kind);
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="tb-remote-inst-card">
      <h2 className="text-sm tb-label mb-4">{title}</h2>
      {children}
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between py-3 border-b border-[var(--tb-border)] last:border-b-0">
      <span className="text-sm tb-muted">{label}</span>
      <span className="text-sm tb-text sm:text-right">{value}</span>
    </div>
  );
}

export default function InstallationDetailPage() {
  const { installationId } = useParams<{ installationId: string }>();
  const { installation, setInstallation, loading, error } = useInstallation(installationId);
  const { isAdmin } = useTaskboardAuth();
  const { t, locale } = useTaskboardI18n();
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  async function handleLifecycleStatusChange(nextStatus: InstallationLifecycleStatus) {
    if (!installation || nextStatus === installation.lifecycle_status) return;

    setStatusSaving(true);
    setStatusError(null);

    try {
      const updated = await updateInstallationLifecycleStatus(installation.id, nextStatus);
      setInstallation(updated);
    } catch {
      setStatusError(t('projects.detail.statusSaveError'));
    } finally {
      setStatusSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10">
        <p className="text-sm tb-muted">{t('projects.detail.loading')}</p>
      </div>
    );
  }

  if (!installation) {
    return (
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10">
        <Link
          to={PROJECTS_PATH}
          className="inline-flex items-center gap-2 text-sm tb-muted hover:text-[var(--tb-accent)] mb-6"
        >
          <ArrowLeft size={16} aria-hidden />
          {t('projects.detail.back')}
        </Link>
        <p className="text-sm tb-text">{error ?? t('projects.detail.notFound')}</p>
      </div>
    );
  }

  const photos = documentsByKind(installation.documents, 'photo');
  const technicalDocs = documentsByKind(installation.documents, 'technical');
  const electricalDocs = documentsByKind(installation.documents, 'electrical');

  return (
    <div className="max-w-screen-2xl mx-auto px-6 md:px-10 pb-8">
      <Link
        to={PROJECTS_PATH}
        className="inline-flex items-center gap-2 text-sm tb-muted hover:text-[var(--tb-accent)] mb-6"
      >
        <ArrowLeft size={16} aria-hidden />
        {t('projects.detail.back')}
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-8">
        <div>
          <span className="tb-label block mb-2">{t('projects.detail.installationLabel')}</span>
          <h1 className="text-2xl tb-text font-medium">
            <TranslatableText text={installation.name} />
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={`tb-remote-inst-light ${lifecycleStatusLightClass(installation.lifecycle_status)}`}
              aria-hidden
            />
            <span className="text-sm tb-text-secondary">
              {statusSaving
                ? t('common.saving')
                : translateInstallationLifecycle(
                    locale,
                    installation.lifecycle_status,
                    INSTALLATION_LIFECYCLE_LABELS[installation.lifecycle_status],
                  )}
            </span>
          </div>
        </div>

        {installation.remote_url ? (
          <div className="flex flex-wrap gap-2">
            {installation.id === PI_CONNECT_POPUP_INSTALLATION_ID ? (
              <button
                type="button"
                className="tb-btn-secondary inline-flex items-center gap-2"
                onClick={() =>
                  openRemotePopupWindow(
                    `/remote-inst/popup/${installation.id}`,
                    `${installation.id}-remote`,
                  )
                }
              >
                {t('projects.detail.openRemote')}
                <ExternalLink size={14} aria-hidden />
              </button>
            ) : (
              <a
                href={installation.remote_url}
                target="_blank"
                rel="noopener noreferrer"
                className="tb-btn-secondary inline-flex items-center gap-2"
              >
                {t('projects.detail.openRemote')}
                <ExternalLink size={14} aria-hidden />
              </a>
            )}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DetailSection title={t('projects.detail.overview')}>
          <MetaRow
            label={t('projects.detail.meta.location')}
            value={translateInstallationLocation(
              locale,
              installation.location,
              INSTALLATION_LOCATION_LABELS[installation.location],
            )}
          />
          <MetaRow
            label={t('projects.detail.meta.currentStatus')}
            value={
              <div className="flex flex-col items-start sm:items-end gap-1 w-full sm:w-auto">
                <select
                  value={installation.lifecycle_status}
                  disabled={statusSaving}
                  onChange={(event) =>
                    void handleLifecycleStatusChange(
                      event.target.value as InstallationLifecycleStatus,
                    )
                  }
                  className="field-input max-w-full sm:min-w-[14rem]"
                  aria-label={t('projects.detail.statusAria')}
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
                {statusSaving ? (
                  <span className="text-xs tb-muted">{t('common.saving')}</span>
                ) : statusError ? (
                  <span className="text-xs text-red-500">{statusError}</span>
                ) : null}
              </div>
            }
          />
          <MetaRow
            label={t('projects.detail.meta.responsible')}
            value={installation.responsible_person ?? '—'}
          />
          <MetaRow
            label={t('projects.detail.meta.lastInspection')}
            value={formatInstallationDate(installation.last_inspection_date)}
          />
          <MetaRow
            label={t('projects.detail.meta.nextMaintenance')}
            value={formatInstallationDate(installation.next_maintenance_date)}
          />
          <MetaRow
            label={t('projects.detail.meta.revizniZprava')}
            value={
              installation.revizni_zprava_available
                ? t('projects.detail.onFile')
                : t('projects.detail.notOnFile')
            }
          />
        </DetailSection>

        <DetailSection title={t('projects.detail.photographs')}>
          {photos.length === 0 ? (
            <p className="text-sm tb-muted">{t('projects.detail.noPhotos')}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {photos.map((photo) => (
                <li key={photo.id} className="rounded-lg border border-[var(--tb-border)] p-3">
                  <p className="text-sm tb-text">
                    {photo.title ? (
                      <TranslatableText text={photo.title} />
                    ) : (
                      t('projects.detail.defaultPhotograph')
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </DetailSection>

        <DetailSection title={t('projects.detail.technical')}>
          {installationId ? (
            <TechnicalDocumentationSection
              installationId={installationId}
              documents={technicalDocs}
              isAdmin={isAdmin}
            />
          ) : null}
        </DetailSection>

        <DetailSection title={t('projects.detail.electrical')}>
          {electricalDocs.length === 0 ? (
            <p className="text-sm tb-muted">{t('projects.detail.noElectrical')}</p>
          ) : (
            <ul className="space-y-2">
              {electricalDocs.map((doc) => (
                <li key={doc.id} className="text-sm tb-text">
                  <TranslatableText text={doc.title} />
                </li>
              ))}
            </ul>
          )}
        </DetailSection>

        <DetailSection title={t('projects.detail.malfunction')}>
          {installation.repairs.length === 0 ? (
            <p className="text-sm tb-muted">{t('projects.detail.noRepairs')}</p>
          ) : (
            <ul className="space-y-4">
              {installation.repairs.map((repair) => (
                <li
                  key={repair.id}
                  className="rounded-lg border border-[var(--tb-border)] p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm tb-text font-medium">
                      <TranslatableText text={repair.summary} />
                    </span>
                    <span className="text-xs tb-muted">
                      {formatInstallationDate(repair.occurred_on)}
                    </span>
                  </div>
                  <p className="text-sm tb-text-secondary">
                    {repair.resolved
                      ? t('projects.detail.repairResolved')
                      : t('projects.detail.repairOpen')}
                    {repair.notes ? (
                      <>
                        {' — '}
                        <TranslatableText text={repair.notes} />
                      </>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </DetailSection>
      </div>
    </div>
  );
}
