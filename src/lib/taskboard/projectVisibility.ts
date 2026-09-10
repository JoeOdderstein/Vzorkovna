import type { Project } from './types';
import { TASKBOARD_ADMIN_USERNAME } from './authUtils';

export function isTaskboardAdmin(
  username: string | null | undefined,
  isAdminFlag = false
): boolean {
  return isAdminFlag || username === TASKBOARD_ADMIN_USERNAME;
}

function usernamesMatch(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** NULL visible_to = everyone; any array value means restricted visibility. */
export function isProjectRestrictedVisibility(project: Pick<Project, 'visible_to'>): boolean {
  return project.visible_to != null;
}

/** Admin always sees a project; NULL visible_to = everyone; [] = admin only. */
export function canUserSeeProject(
  project: Project,
  username: string | null | undefined,
  isAdminFlag = false
): boolean {
  if (isTaskboardAdmin(username, isAdminFlag)) return true;
  if (!username) return false;

  const allowed = project.visible_to;
  if (allowed == null) return true;
  if (allowed.length === 0) return false;

  return allowed.some((name) => usernamesMatch(name, username));
}

export function filterProjectsForUser(
  projects: Project[],
  username: string | null | undefined,
  isAdminFlag = false
): Project[] {
  if (isTaskboardAdmin(username, isAdminFlag)) return projects;
  return projects.filter((project) => canUserSeeProject(project, username, isAdminFlag));
}

export function normalizeVisibleTo(
  selected: string[],
  allNonAdminUsernames: string[]
): string[] | null {
  if (allNonAdminUsernames.length === 0) return null;
  if (selected.length === 0) return [];
  const uniqueSelected = [...new Set(selected)];
  if (uniqueSelected.length >= allNonAdminUsernames.length) return null;
  return uniqueSelected;
}

export function normalizeProjectVisibleTo(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const values = raw.map((value) => String(value).trim()).filter(Boolean);
    return values.length > 0 ? values : [];
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '{}') return [];
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const values = trimmed
        .slice(1, -1)
        .split(',')
        .map((value) => value.trim().replace(/^"|"$/g, ''))
        .filter(Boolean);
      return values.length > 0 ? values : [];
    }
    return [trimmed];
  }
  return null;
}

export function visibleToSelection(
  visibleTo: string[] | null | undefined,
  allNonAdminUsernames: string[]
): string[] {
  if (visibleTo == null) return [...allNonAdminUsernames];
  return visibleTo
    .map((name) => allNonAdminUsernames.find((user) => usernamesMatch(user, name)))
    .filter((name): name is string => Boolean(name));
}
