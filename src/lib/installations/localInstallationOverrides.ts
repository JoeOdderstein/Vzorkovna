import type {
  InstallationLifecycleStatus,
  InstallationLocation,
  InstallationRecord,
} from './types';

const STORAGE_KEY = 'installation_local_overrides_v1';

export type InstallationLocalPatch = Partial<
  Pick<
    InstallationRecord,
    | 'name'
    | 'location'
    | 'lifecycle_status'
    | 'lifecycle_status_manual_override'
    | 'operational_status'
    | 'responsible_person'
    | 'last_inspection_date'
    | 'next_maintenance_date'
    | 'revizni_zprava_available'
    | 'remote_url'
    | 'taskboard_project_id'
  >
>;

type LocalInstallationOverrides = Record<string, InstallationLocalPatch>;

function loadOverrides(): LocalInstallationOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LocalInstallationOverrides;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveOverrides(overrides: LocalInstallationOverrides) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export function getLocalInstallationPatch(installationId: string): InstallationLocalPatch | undefined {
  const entry = loadOverrides()[installationId];
  return entry && Object.keys(entry).length > 0 ? entry : undefined;
}

export function mergeLocalInstallationPatch(
  installationId: string,
  patch: InstallationLocalPatch,
) {
  const overrides = loadOverrides();
  overrides[installationId] = { ...overrides[installationId], ...patch };
  saveOverrides(overrides);
}

/** @deprecated use mergeLocalInstallationPatch */
export function getLocalLifecycleOverride(
  installationId: string,
): InstallationLifecycleStatus | undefined {
  return loadOverrides()[installationId]?.lifecycle_status;
}

/** @deprecated use mergeLocalInstallationPatch */
export function setLocalLifecycleOverride(
  installationId: string,
  lifecycle_status: InstallationLifecycleStatus,
) {
  mergeLocalInstallationPatch(installationId, { lifecycle_status });
}

export function applyLocalInstallationPatches(records: InstallationRecord[]): InstallationRecord[] {
  const overrides = loadOverrides();
  return records.map((record) => {
    const patch = overrides[record.id];
    if (!patch) return record;
    return { ...record, ...patch };
  });
}

export function notifyInstallationsUpdated() {
  window.dispatchEvent(new Event('installations-updated'));
}

export type { InstallationLocation };
