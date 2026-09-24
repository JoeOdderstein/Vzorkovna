import type { InstallationLifecycleStatus } from './types';

const STORAGE_KEY = 'installation_local_overrides_v1';

type LocalInstallationOverrides = Record<
  string,
  {
    lifecycle_status?: InstallationLifecycleStatus;
  }
>;

function loadOverrides(): LocalInstallationOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as LocalInstallationOverrides;
  } catch {
    return {};
  }
}

function saveOverrides(overrides: LocalInstallationOverrides) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export function getLocalLifecycleOverride(
  installationId: string,
): InstallationLifecycleStatus | undefined {
  return loadOverrides()[installationId]?.lifecycle_status;
}

export function setLocalLifecycleOverride(
  installationId: string,
  lifecycle_status: InstallationLifecycleStatus,
) {
  const overrides = loadOverrides();
  overrides[installationId] = { ...overrides[installationId], lifecycle_status };
  saveOverrides(overrides);
}

export function notifyInstallationsUpdated() {
  window.dispatchEvent(new Event('installations-updated'));
}
