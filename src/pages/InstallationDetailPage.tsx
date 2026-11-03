import { useEffect, useState, type ReactNode } from 'react';
import { ExternalLink, Pencil } from 'lucide-react';
import { useParams } from 'react-router-dom';
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
import {
  translateInstallationLifecycle,
  translateInstallationLocation,
} from '../lib/taskboard/i18n/messages';
import { openRemotePopupWindow } from '../lib/taskboard/openRemotePopup';
import { fetchProjects } from '../lib/taskboard/taskService';
import type { Project } from '../lib/taskboard/types';
import InstallationProjectHeader from '../components/installations/InstallationProjectHeader';
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
  className = '',
}: {
  title: string;
  adminAction?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`tb-remote-inst-card ${className}`.trim()}>
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
  const [taskboardProjects, setTaskboardProjects] = useState<Project[]>([]);

  useEffect(() => {
    void fetchProjects()
      .then(setTaskboardProjects)
      .catch(() => setTaskboardProjects([]));
  }, []);

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
      case 'taskboard_project_id':
        patch.taskboard_project_id = String(value).trim() || null;
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

  const locationLabel = translateInstallationLocation(
    locale,
    installation.location,
    INSTALLATION_LOCATION_LABELS[installation.location],
  );

  const taskboardProjectLabel = installation.taskboard_project_id
    ? (taskboardProjects.find((p) => p.id === installation.taskboard_project_id)?.name ??
      '—')
    : t('projects.detail.taskboardProjectAuto');

  return (
    <div className="max-w-screen-2xl mx-auto px-6 md:px-10 pb-8 pt-1">
      <header className="tb-installation-detail-hero mb-8">
        {installationId ? (
          <InstallationProjectHeader
            installationId={installationId}
            headerImagePath={installation.header_image_path}
            headerImageFocusY={installation.header_image_focus_y}
            projectName={installation.name}
            variant="detail"
            integrated
            isAdmin={isAdmin}
          />
        ) : null}

        {isAdmin ? (
          <button
            type="button"
            onClick={() => setEditField('name')}
            className="text-xs tb-btn-secondary tb-installation-detail-hero__edit tb-installation-detail-hero__edit--banner-corner inline-flex items-center gap-1 shrink-0"
          >
            <Pencil size={12} aria-hidden />
            {t('projects.admin.edit')}
          </button>
        ) : null}

        <div className="tb-installation-detail-hero__content">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start gap-3">
              <h1 className="text-2xl font-medium tb-installation-detail-hero__title leading-snug">
                <span className="tb-installation-detail-hero__location">{locationLabel}</span>
                <span className="mx-2 font-normal opacity-70" aria-hidden>
                  |
                </span>
                <TranslatableText text={installation.name} />
              </h1>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => setEditField('name')}
                  className="text-xs tb-btn-secondary tb-installation-detail-hero__edit tb-installation-detail-hero__edit--inline inline-flex items-center gap-1 shrink-0 mt-1"
                >
                  <Pencil size={12} aria-hidden />
                  {t('projects.admin.edit')}
                </button>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span
                className={`tb-remote-inst-light ${lifecycleStatusLightClass(installation.lifecycle_status)}`}
                aria-hidden
              />
              <span className="text-sm tb-installation-detail-hero__status">{lifecycleLabel}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-2 shrink-0 sm:justify-end w-full md:w-auto">
            <button
              type="button"
              onClick={() => setBugDialogOpen(true)}
              className="w-full sm:w-auto px-6 py-3 text-sm font-bold tracking-wide rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors shadow-md inline-flex items-center justify-center"
            >
              {t('projects.bug.reportButton')}
            </button>
            {installation.remote_url ? (
              installation.id === PI_CONNECT_POPUP_INSTALLATION_ID ? (
                <button
                  type="button"
                  className="tb-btn-secondary tb-installation-detail-hero__remote inline-flex items-center justify-center gap-2 w-full sm:w-auto"
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
                  className="tb-btn-secondary tb-installation-detail-hero__remote inline-flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  {t('projects.detail.openRemote')}
                  <ExternalLink size={14} aria-hidden />
                </a>
              )
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-6 mb-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6 order-1">
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
          {isAdmin ? (
            <AdminMetaRow
              label={t('projects.detail.meta.taskboardProject')}
              value={taskboardProjectLabel}
              isAdmin={isAdmin}
              onEdit={() => setEditField('taskboard_project_id')}
            />
          ) : null}
          </DetailSection>

          <DetailSection title={t('projects.detail.malfunction')} className="hidden lg:block">
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

        <DetailSection title={t('projects.detail.technical')} className="order-2 min-w-0 flex-1">
          {installationId ? (
            <InstallationDocumentsPanel
              installationId={installationId}
              kind="technical"
              documents={technicalDocs}
              isAdmin={isAdmin}
              emptyLabel={t('projects.tech.noDocs')}
              uploadLabel={t('projects.tech.uploadPdfOrDocx')}
              accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
              pdfKind
              allowDocx
              embedPdf
            />
          ) : null}
        </DetailSection>

        <DetailSection title={t('projects.detail.malfunction')} className="order-3 lg:hidden">
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

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <DetailSection title={t('projects.detail.photographs')} className="min-w-0 flex-1">
          {installationId ? (
            <InstallationDocumentsPanel
              installationId={installationId}
              kind="photo"
              documents={photos}
              isAdmin={isAdmin}
              emptyLabel={t('projects.detail.noPhotos')}
              uploadLabel={t('projects.admin.upload')}
              accept="*/*"
              allowAnyDocuments
            />
          ) : null}
        </DetailSection>

        <DetailSection title={t('projects.detail.electrical')} className="min-w-0 flex-1">
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
