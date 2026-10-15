import { CALENDAR_PATH } from './driveConstants';
import type { Project } from './types';

export const CALENDAR_PROJECT_QUERY_KEY = 'project';

export function calendarProjectTimelineUrl(
  projectSlug: string,
  origin = typeof window !== 'undefined' ? window.location.origin : ''
): string {
  const base = origin.replace(/\/$/, '');
  return `${base}${CALENDAR_PATH}?${CALENDAR_PROJECT_QUERY_KEY}=${encodeURIComponent(projectSlug)}`;
}

export function findProjectByCalendarQuery(
  query: string | null | undefined,
  projects: Project[]
): Project | null {
  const raw = query?.trim();
  if (!raw || projects.length === 0) return null;
  const lower = raw.toLowerCase();
  return (
    projects.find((p) => p.slug.toLowerCase() === lower) ??
    projects.find((p) => p.id.toLowerCase() === lower) ??
    null
  );
}
