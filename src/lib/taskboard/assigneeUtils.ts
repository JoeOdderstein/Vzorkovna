import type { Assignee } from './constants';
import type { Task } from './types';

/** Normalize legacy single assignee or array from API/localStorage. */
export function normalizeAssignees(value: unknown): Assignee[] {
  if (Array.isArray(value)) {
    return value.filter((a): a is Assignee => typeof a === 'string');
  }
  if (typeof value === 'string' && value) {
    return [value as Assignee];
  }
  return [];
}

export function normalizeTask<T extends Record<string, unknown>>(row: T): Task {
  const assignees = normalizeAssignees(row.assignees ?? row.assigned_to);
  const { assigned_to: _legacy, ...rest } = row;
  return { ...rest, assignees } as unknown as Task;
}

export function taskHasAssignee(task: Task, assignee: Assignee): boolean {
  return (task.assignees ?? []).includes(assignee);
}

export function formatAssignees(assignees: Assignee[] | undefined): string {
  return (assignees ?? []).join(', ');
}

export function toggleAssignee(current: Assignee[], assignee: Assignee): Assignee[] {
  return current.includes(assignee)
    ? current.filter((a) => a !== assignee)
    : [...current, assignee];
}
