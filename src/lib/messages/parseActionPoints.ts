import type { Assignee, TaskCategory } from '../taskboard/constants';
import type { Project } from '../taskboard/types';
import type { TeamMessageActionPoint } from './types';

export type ParseActionPointsResult = {
  tasks: TeamMessageActionPoint[];
  projects: Pick<Project, 'id' | 'name' | 'slug'>[];
  assignees: Assignee[];
};

export async function parseActionPointsFromText(text: string): Promise<ParseActionPointsResult> {
  let res: Response;
  try {
    res = await fetch('/api/messages/parse-action-points', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (/fetch failed|network|load failed/i.test(msg)) {
      throw new Error(
        'Could not reach the app API. Use the same URL as the dev server (check the terminal for localhost port), log in again, and restart with npm run dev.',
      );
    }
    throw err;
  }

  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }
  if (!res.ok) {
    throw new Error((data.error as string) || 'Could not suggest action points.');
  }

  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const assignees = Array.isArray(data.assignees) ? data.assignees : [];

  return {
    tasks: tasks.map((row: Record<string, unknown>) => ({
      taskName: String(row.taskName ?? ''),
      projectId: String(row.projectId ?? ''),
      category: String(row.category ?? 'quotations') as TaskCategory,
      assignees: Array.isArray(row.assignees) ? (row.assignees as Assignee[]) : [],
    })),
    projects: projects.map((row: Record<string, unknown>) => ({
      id: String(row.id ?? ''),
      name: String(row.name ?? ''),
      slug: String(row.slug ?? ''),
    })),
    assignees: assignees.map((a) => String(a)) as Assignee[],
  };
}
