import { INSTALLATION_SEED_RECORDS } from '../installations/seedData';
import type { InstallationOperationalStatus } from '../installations/types';

export type RemoteInstStatus = InstallationOperationalStatus;

export interface RemoteInstallation {
  id: string;
  name: string;
  status: RemoteInstStatus;
  statusLabel: string;
  url?: string;
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

export const REMOTE_INSTALLATIONS: RemoteInstallation[] = INSTALLATION_SEED_RECORDS.map(
  (installation) => ({
    id: installation.id,
    name: installation.name,
    status: installation.operational_status,
    statusLabel: operationalStatusLabel(installation.operational_status),
    url: installation.remote_url ?? undefined,
  }),
);
