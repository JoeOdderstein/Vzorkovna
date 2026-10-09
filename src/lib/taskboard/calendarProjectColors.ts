import { useCallback, useMemo } from 'react';
import type { Project } from './types';

/** Distinct calendar chip colors (cycles when there are more projects). */
export const PROJECT_CALENDAR_PALETTE_SIZE = 12;

export function buildProjectCalendarColorIndex(projects: Project[]): Map<string, number> {
  const sorted = [...projects].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  );
  const map = new Map<string, number>();
  sorted.forEach((project, index) => {
    map.set(project.id, index % PROJECT_CALENDAR_PALETTE_SIZE);
  });
  return map;
}

export function projectCalendarColorClass(colorIndex: number): string {
  const safe = ((colorIndex % PROJECT_CALENDAR_PALETTE_SIZE) + PROJECT_CALENDAR_PALETTE_SIZE)
    % PROJECT_CALENDAR_PALETTE_SIZE;
  return `tb-cal-project-${safe}`;
}

export function projectCalendarColorClassForId(
  projectId: string,
  colorIndexByProject: Map<string, number>
): string {
  return projectCalendarColorClass(colorIndexByProject.get(projectId) ?? 0);
}

/** Stable project → `tb-cal-project-N` class for a visible project list. */
export function useProjectCalendarColorClass(projects: Project[]) {
  const colorIndexByProject = useMemo(
    () => buildProjectCalendarColorIndex(projects),
    [projects]
  );
  return useCallback(
    (projectId: string) => projectCalendarColorClassForId(projectId, colorIndexByProject),
    [colorIndexByProject]
  );
}
