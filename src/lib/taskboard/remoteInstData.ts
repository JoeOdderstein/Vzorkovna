export type RemoteInstStatus = 'active' | 'issues' | 'broken';

export interface RemoteInstallation {
  id: string;
  name: string;
  status: RemoteInstStatus;
  statusLabel: string;
  url?: string;
}

export const REMOTE_INSTALLATIONS: RemoteInstallation[] = [
  { id: 'big-tankshot', name: 'Big Tankshot', status: 'active', statusLabel: 'Active' },
  { id: 'small-tankshot', name: 'Small Tankshot', status: 'active', statusLabel: 'Active' },
  { id: 'elements-room', name: 'Elements Room', status: 'issues', statusLabel: 'Issues detected' },
  { id: 'vulva-room', name: 'Vulva Room', status: 'active', statusLabel: 'Active' },
  {
    id: 'slapshot',
    name: 'Slapshot',
    status: 'broken',
    statusLabel: 'Offline',
    url: 'https://fierce-rabbit-7109.dataplicity.io/',
  },
  { id: 'carousel', name: 'Carousel', status: 'active', statusLabel: 'Active' },
];
