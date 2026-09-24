import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useInstallations } from '../../hooks/useInstallations';
import {
  groupInstallationsByLocation,
  INSTALLATION_LIFECYCLE_LABELS,
  type InstallationLifecycleFilter,
  lifecycleStatusLightClass,
  PI_CONNECT_POPUP_INSTALLATION_ID,
} from '../../lib/installations/constants';
import AddInstallationDialog from './AddInstallationDialog';
import InstallationStatusFilterBar from './InstallationStatusFilterBar';
import type { InstallationOperationalStatus, InstallationRecord } from '../../lib/installations/types';
import { installationDetailPath } from '../../lib/taskboard/driveConstants';
import { openRemotePopupWindow } from '../../lib/taskboard/openRemotePopup';

function operationalLightClass(status: InstallationOperationalStatus) {
  switch (status) {
    case 'active':
      return 'tb-remote-inst-light--active';
    case 'issues':
      return 'tb-remote-inst-light--issues';
    case 'broken':
      return 'tb-remote-inst-light--broken';
  }
}

function operationalStatusLabel(status: InstallationOperationalStatus) {
  switch (status) {
    case 'active':
      return 'Active';
    case 'issues':
      return 'Issues detected';
    case 'broken':
      return 'Offline';
  }
}

interface RemoteInstallationOverviewProps {
  label: string;
  description: string;
  variant?: 'projects' | 'remote-inst';
}

function InstallationCard({
  installation,
  linkToDetail,
}: {
  installation: InstallationRecord;
  linkToDetail: boolean;
}) {
  const statusLabel = linkToDetail
    ? INSTALLATION_LIFECYCLE_LABELS[installation.lifecycle_status]
    : operationalStatusLabel(installation.operational_status);

  const content = (
    <>
      <h2 className="text-base tb-text font-medium">{installation.name}</h2>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`tb-remote-inst-light ${
              linkToDetail
                ? lifecycleStatusLightClass(installation.lifecycle_status)
                : operationalLightClass(installation.operational_status)
            }`}
            aria-hidden
          />
          <span className="text-sm tb-text-secondary">{statusLabel}</span>
        </div>
        {linkToDetail || installation.remote_url ? (
          <span className="inline-flex items-center gap-1 text-xs tb-muted shrink-0">
            Open
            <ExternalLink size={12} aria-hidden />
          </span>
        ) : null}
      </div>
    </>
  );

  const cardClassName =
    'tb-remote-inst-card tb-remote-inst-card--link block w-full text-left hover:border-[var(--tb-accent)] transition-colors';

  if (linkToDetail) {
    return (
      <Link to={installationDetailPath(installation.id)} className={cardClassName}>
        {content}
      </Link>
    );
  }

  if (installation.remote_url) {
    if (installation.id === PI_CONNECT_POPUP_INSTALLATION_ID) {
      return (
        <button
          type="button"
          onClick={() =>
            openRemotePopupWindow(
              `/remote-inst/popup/${installation.id}`,
              `${installation.id}-remote`,
            )
          }
          className={cardClassName}
        >
          {content}
        </button>
      );
    }

    return (
      <a
        href={installation.remote_url}
        target="_blank"
        rel="noopener noreferrer"
        className={cardClassName}
      >
        {content}
      </a>
    );
  }

  return (
    <Link to={installationDetailPath(installation.id)} className={cardClassName}>
      {content}
    </Link>
  );
}

export default function RemoteInstallationOverview({
  label,
  description,
  variant = 'remote-inst',
}: RemoteInstallationOverviewProps) {
  const { installations, loading, error } = useInstallations();
  const linkToDetail = variant === 'projects';
  const [statusFilter, setStatusFilter] = useState<InstallationLifecycleFilter>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const filteredInstallations = useMemo(() => {
    if (statusFilter === 'all') return installations;
    return installations.filter(
      (installation) => installation.lifecycle_status === statusFilter,
    );
  }, [installations, statusFilter]);

  const groups = groupInstallationsByLocation(
    filteredInstallations,
    linkToDetail && statusFilter === 'all',
  );

  return (
    <div className="max-w-screen-2xl mx-auto px-6 md:px-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <span className="tb-label block mb-2">{label}</span>
          <p className="text-sm tb-muted">{description}</p>
        </div>
        {linkToDetail ? (
          <button
            type="button"
            onClick={() => setAddDialogOpen(true)}
            className="tb-btn-primary shrink-0 whitespace-nowrap"
          >
            Add project
          </button>
        ) : null}
      </div>

      {loading ? <p className="text-sm tb-muted">Loading installations…</p> : null}
      {error ? <p className="text-sm tb-text-secondary">{error}</p> : null}

      {!loading && !error && linkToDetail ? (
        <InstallationStatusFilterBar
          installations={installations}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />
      ) : null}

      {!loading && !error ? (
        groups.length === 0 ? (
          <p className="text-sm tb-muted">No installations match this status.</p>
        ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.location} aria-labelledby={`location-${group.location}`}>
              <h2 id={`location-${group.location}`} className="tb-label block mb-4">
                {group.label}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.installations.map((installation) => (
                  <li key={installation.id}>
                    <InstallationCard installation={installation} linkToDetail={linkToDetail} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        )
      ) : null}

      {linkToDetail ? (
        <AddInstallationDialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} />
      ) : null}
    </div>
  );
}
