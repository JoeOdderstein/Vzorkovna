import { TASK_CATEGORIES, type TaskCategory } from './constants';
import type { Task, TaskGroup } from './types';

export function buildGroupsByCategory(tasks: Task[]): Record<TaskCategory, TaskGroup[]> {
  const taskIds = new Set(tasks.map((t) => t.id));
  const map: Record<TaskCategory, TaskGroup[]> = {
    quotations: [],
    designing: [],
    installation: [],
    repairs: [],
  };

  for (const { id } of TASK_CATEGORIES) {
    const inCategory = tasks.filter((t) => t.category === id);

    const parents = inCategory
      .filter((t) => !t.parent_task_id)
      .sort((a, b) => a.sort_order - b.sort_order);

    const groups: TaskGroup[] = parents.map((parent) => ({
      parent,
      subtasks: inCategory
        .filter((t) => t.parent_task_id === parent.id)
        .sort((a, b) => a.sort_order - b.sort_order),
    }));

    const orphans = inCategory
      .filter((t) => t.parent_task_id && !taskIds.has(t.parent_task_id))
      .sort((a, b) => a.sort_order - b.sort_order);

    for (const orphan of orphans) {
      groups.push({ parent: orphan, subtasks: [] });
    }

    groups.sort((a, b) => a.parent.sort_order - b.parent.sort_order);
    map[id] = groups;
  }

  return map;
}

export function getVisibleCategories(tasks: Task[]): { id: TaskCategory; label: string }[] {
  const groups = buildGroupsByCategory(tasks);
  return TASK_CATEGORIES.filter(({ id }) => groups[id].length > 0);
}

export function getCategoryLabel(id: TaskCategory) {
  return TASK_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
