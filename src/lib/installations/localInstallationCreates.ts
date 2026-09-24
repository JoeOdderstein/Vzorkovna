import type { InstallationRecord } from './types';

const STORAGE_KEY = 'installation_local_creates_v1';

export function loadLocalCreatedInstallations(): InstallationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as InstallationRecord[];
  } catch {
    return [];
  }
}

export function appendLocalCreatedInstallation(record: InstallationRecord) {
  const existing = loadLocalCreatedInstallations();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, record]));
}
