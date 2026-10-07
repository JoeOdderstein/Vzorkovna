import { useState, type ReactNode } from 'react';
import { ArrowLeft, ExternalLink, Pencil } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import InstallationDocumentsPanel from '../components/installations/InstallationDocumentsPanel';
import InstallationFieldEditDialog, {
  type InstallationEditableField,
} from '../components/installations/InstallationFieldEditDialog';
import InstallationRepairsSection from '../components/installations/InstallationRepairsSection';
import { useTaskboardAuth } from '../context/TaskboardAuthContext';
import { useInstallation } from '../hooks/useInstallations';
import { useTaskboardI18n } from '../hooks/useTaskboardI18n';
import {
  INSTALLATION_LIFECYCLE_LABELS,
  INSTALLATION_LOCATION_LABELS,
  lifecycleStatusLightClass,
  PI_CONNECT_POPUP_INSTALLATION_ID,
} from '../lib/installations/constants';
import { formatInstallationDate } from '../lib/installations/format';
import {
  updateInstallationFields,
  type InstallationUpdatePatch,
} from '../lib/installations/installationService';
import type { InstallationDocumentKind, InstallationRecord } from '../lib/installations/types';
import { PROJECTS_PATH } from '../lib/taskboard/driveConstants';
import {
  translateInstallationLifecycle,
  translateInstallationLocation,
} from '../lib/taskboard/i18n/messages';
import { openRemotePopupWindow } from '../lib/taskboard/openRemotePopup';
import ReportBugDialog from '../components/installations/ReportBugDialog';
import TranslatableText from '../taskboard/components/TranslatableText';

function documentsByKind(
  documents: InstallationRecord['documents'],
  kind: InstallationDocumentKind,
) {
  return documents.filter((document) => document.kind === kind);
}

function DetailSection({
  title,
  adminAction,
  children,
}: {
  title: string;
  adminAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="tb-remote-inst-card">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-sm tb-label">{title}</h2>
        {adminAction}
      </div>
      {children}
    </section>
  );
}

function AdminMetaRow({
  label,
  value,
  isAdmin,
  onEdit,
}: {
  label: string;
  value: ReactNode;
  isAdmin: boolean;
  onEdit?: () => void;
}) {
  const { t } = useTaskboardI18n();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between py-3 border-b border-[var(--tb-border)] last:border-b-0">
      <span className="text-sm tb-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <span className="text-sm tb-text sm:text-right">{value}</span>
        {isAdmin && onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs tb-btn-secondary inline-flex items-center gap-1 shrink-0"
          >
            <Pencil size={12} aria-hidden />
            {t('projects.admin.edit')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function InstallationDetailPage() {
  const { installationId } = useParams<{ installationId: string }>();
  const { installation, setInstallation, loading, error } = useInstallation(installationId);
  const { isAdmin } = useTaskboardAuth();
  const { t, locale } = useTaskboardI18n();
  const [editField, setEditField] = useState<InstallationEditableField | null>(null);
  const [bugDialogOpen, setBugDialogOpen] = useState(false);

  async function handleFieldSave(field: InstallationEditableField, value: string | boolean) {
    if (!installation) return;

    const patch: InstallationUpdatePatch = {};
    switch (field) {
      case 'name':
        patch.name = String(value);
        break;
      case 'location':
        patch.location = value as InstallationRecord['location'];
        break;
      case 'lifecycle_status':
        patch.lifecycle_status = value as InstallationRecord['lifecycle_status'];
        break;
      case 'responsible_person':
        patch.responsible_person = String(value);
        break;
      case 'last_inspection_date':
        patch.last_inspection_date = String(value);
        break;
      case 'next_maintenance_date':
        patch.next_maintenance_date = String(value);
        break;
      case 'revizni_zprava_available':
        patch.revizni_zprava_available = Boolean(value);
        break;
      case 'remote_url':
        patch.remote_url = String(value);
        break;
    }

    const updated = await updateInstallationFields(installation.id, patch);
    setInstallation(updated);
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

  const lifecycleLabel = translateInstallationLifecycle(
    locale,
    installation.lifecycle_status,
    INSTALLATION_LIFECYCLE_LABELS[installation.lifecycle_status],
  );

  return (
    <div className="max-w-screen-2xl mx-auto px-6 md:px-10 pb-8">
      <Link
        to={PROJECTS_PATH}
        className="inline-flex items-center gap-2 text-sm tb-muted hover:text-[var(--tb-accent)] mb-6"
      >
        <ArrowLeft size={16} aria-hidden />
        {t('projects.detail.back')}
      </Link>

      <div className="mb-6">
        <button
          type="button"
          onClick={() => setBugDialogOpen(true)}
          className="w-full sm:w-auto px-8 py-4 text-base font-bold tracking-wide rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors shadow-md"
        >
          {t('projects.bug.reportButton')}
        </button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-8">
        <div className="min-w-0 flex-1">
          <span className="tb-label block mb-2">{t('projects.detail.installationLabel')}</span>
          <div className="flex flex-wrap items-start gap-3">
            <h1 className="text-2xl tb-text font-medium">
              <TranslatableText text={installation.name} />
            </h1>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setEditField('name')}
                className="text-xs tb-btn-secondary inline-flex items-center gap-1 shrink-0 mt-1"
              >
                <Pencil size={12} />
                {t('projects.admin.edit')}
              </button>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={`tb-remote-inst-light ${lifecycleStatusLightClass(installation.lifecycle_status)}`}
              aria-hidden
            />
            <span className="text-sm tb-text-secondary">{lifecycleLabel}</span>
          </div>
        </div>

        {installation.remote_url ? (
          <div className="flex flex-wrap gap-2 shrink-0">
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
          <AdminMetaRow
            label={t('projects.detail.meta.location')}
            value={translateInstallationLocation(
              locale,
              installation.location,
              INSTALLATION_LOCATION_LABELS[installation.location],
            )}
            isAdmin={isAdmin}
            onEdit={() => setEditField('location')}
          />
          <AdminMetaRow
            label={t('projects.detail.meta.currentStatus')}
            value={lifecycleLabel}
            isAdmin={isAdmin}
            onEdit={() => setEditField('lifecycle_status')}
          />
          <AdminMetaRow
            label={t('projects.detail.meta.responsible')}
            value={installation.responsible_person ?? '—'}
            isAdmin={isAdmin}
            onEdit={() => setEditField('responsible_person')}
          />
          <AdminMetaRow
            label={t('projects.detail.meta.lastInspection')}
            value={formatInstallationDate(installation.last_inspection_date)}
            isAdmin={isAdmin}
            onEdit={() => setEditField('last_inspection_date')}
          />
          <AdminMetaRow
            label={t('projects.detail.meta.nextMaintenance')}
            value={formatInstallationDate(installation.next_maintenance_date)}
            isAdmin={isAdmin}
            onEdit={() => setEditField('next_maintenance_date')}
          />
          <AdminMetaRow
            label={t('projects.detail.meta.revizniZprava')}
            value={
              installation.revizni_zprava_available
                ? t('projects.detail.onFile')
                : t('projects.detail.notOnFile')
            }
            isAdmin={isAdmin}
            onEdit={() => setEditField('revizni_zprava_available')}
          />
          <AdminMetaRow
            label={t('projects.detail.meta.remoteUrl')}
            value={
              installation.remote_url ? (
                <span className="break-all">{installation.remote_url}</span>
              ) : (
                '—'
              )
            }
            isAdmin={isAdmin}
            onEdit={() => setEditField('remote_url')}
          />
        </DetailSection>

        <DetailSection title={t('projects.detail.photographs')}>
          {installationId ? (
            <InstallationDocumentsPanel
              installationId={installationId}
              kind="photo"
              documents={photos}
              isAdmin={isAdmin}
              emptyLabel={t('projects.detail.noPhotos')}
              uploadLabel={t('projects.admin.upload')}
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            />
          ) : null}
        </DetailSection>

        <DetailSection title={t('projects.detail.technical')}>
          {installationId ? (
            <InstallationDocumentsPanel
              installationId={installationId}
              kind="technical"
              documents={technicalDocs}
              isAdmin={isAdmin}
              emptyLabel={t('projects.tech.noDocs')}
              uploadLabel={t('projects.tech.upload')}
              accept="application/pdf,.pdf"
              pdfKind
            />
          ) : null}
        </DetailSection>

        <DetailSection title={t('projects.detail.electrical')}>
          {installationId ? (
            <InstallationDocumentsPanel
              installationId={installationId}
              kind="electrical"
              documents={electricalDocs}
              isAdmin={isAdmin}
              emptyLabel={t('projects.detail.noElectrical')}
              uploadLabel={t('projects.admin.upload')}
              accept="application/pdf,.pdf"
              pdfKind
            />
          ) : null}
        </DetailSection>

        <DetailSection title={t('projects.detail.malfunction')}>
          {installationId ? (
            <InstallationRepairsSection
              installationId={installationId}
              repairs={installation.repairs}
              documents={installation.documents}
              isAdmin={isAdmin}
            />
          ) : null}
        </DetailSection>
      </div>

      <InstallationFieldEditDialog
        open={editField !== null}
        field={editField}
        installation={installation}
        onClose={() => setEditField(null)}
        onSave={handleFieldSave}
      />

      {installationId ? (
        <ReportBugDialog
          open={bugDialogOpen}
          installationId={installationId}
          onClose={() => setBugDialogOpen(false)}
          onSubmitted={() => {
            window.dispatchEvent(new Event('installations-updated'));
          }}
        />
      ) : null}
    </div>
  );
}
