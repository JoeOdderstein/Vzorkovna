import type {
  InstallationDocumentKind,
  InstallationLifecycleStatus,
  InstallationLocation,
  InstallationRecord,
} from './types';

export const INSTALLATION_LIFECYCLE_STATUSES: InstallationLifecycleStatus[] = [
  'concept',
  'implementation',
  'waiting_tech_approval',
  'operational',
  'maintenance_needed',
];

export const INSTALLATION_LIFECYCLE_LABELS: Record<InstallationLifecycleStatus, string> = {
  concept: 'Concept phase',
  implementation: 'Implementation phase',
  waiting_tech_approval: 'Pending tech approval',
  operational: 'Operational',
  maintenance_needed: 'Maintenance needed',
};

export type InstallationLifecycleFilter = 'all' | InstallationLifecycleStatus;

export const INSTALLATION_LIFECYCLE_FILTERS: { id: InstallationLifecycleFilter; label: string }[] =
  [
    { id: 'all', label: 'All' },
    ...INSTALLATION_LIFECYCLE_STATUSES.map((id) => ({
      id,
      label: INSTALLATION_LIFECYCLE_LABELS[id],
    })),
  ];

export const INSTALLATION_DOCUMENT_KIND_LABELS: Record<InstallationDocumentKind, string> = {
  photo: 'Photograph',
  technical: 'Technical documentation',
  electrical: 'Electrical documentation',
};

export const INSTALLATION_LOCATIONS: InstallationLocation[] = [
  'my_people_bar',
  'vzorkovna',
  'krakow',
];

export const INSTALLATION_LOCATION_LABELS: Record<InstallationLocation, string> = {
  my_people_bar: 'My People Bar',
  vzorkovna: 'Vzorkovna',
  krakow: 'Kraków',
};

/** Downstairs TankShot — opens Pi Connect in a sized popup window. */
export const PI_CONNECT_POPUP_INSTALLATION_ID = 'tankshot-downstairs';

/** Order on Projects page when filter is “All” (most attention first). */
export const INSTALLATION_LIFECYCLE_SORT_ORDER: Record<InstallationLifecycleStatus, number> = {
  maintenance_needed: 0,
  waiting_tech_approval: 1,
  implementation: 2,
  concept: 3,
  operational: 4,
};

export function compareInstallationsByLifecyclePriority(
  a: InstallationRecord,
  b: InstallationRecord,
) {
  const byStatus =
    INSTALLATION_LIFECYCLE_SORT_ORDER[a.lifecycle_status] -
    INSTALLATION_LIFECYCLE_SORT_ORDER[b.lifecycle_status];
  if (byStatus !== 0) return byStatus;
  return a.sort_order - b.sort_order;
}

export function lifecycleStatusLightClass(status: InstallationLifecycleStatus) {
  switch (status) {
    case 'operational':
      return 'tb-remote-inst-light--active';
    case 'implementation':
    case 'waiting_tech_approval':
      return 'tb-remote-inst-light--issues';
    case 'maintenance_needed':
      return 'tb-remote-inst-light--broken';
    case 'concept':
      return 'tb-remote-inst-light--concept';
  }
}

export function groupInstallationsByLocation(
  installations: InstallationRecord[],
  sortByLifecyclePriority = false,
) {
  return INSTALLATION_LOCATIONS.map((location) => ({
    location,
    label: INSTALLATION_LOCATION_LABELS[location],
    installations: installations
      .filter((installation) => installation.location === location)
      .sort((a, b) =>
        sortByLifecyclePriority
          ? compareInstallationsByLifecyclePriority(a, b)
          : a.sort_order - b.sort_order,
      ),
  })).filter((group) => group.installations.length > 0);
}
