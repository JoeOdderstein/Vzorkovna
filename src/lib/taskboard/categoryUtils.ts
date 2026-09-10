import { TASK_CATEGORIES } from './constants';
import type { CategoryOption, Task, TaskGroup } from './types';

export const DEFAULT_CATEGORIES: CategoryOption[] = TASK_CATEGORIES.map(({ id, label }) => ({
  id,
  label,
}));

export function categoriesForTasks(tasks: Task[], categories: CategoryOption[]): CategoryOption[] {
  const merged = [...categories];
  const knownIds = new Set(categories.map((category) => category.id));

  for (const task of tasks) {
    if (knownIds.has(task.category)) continue;
    merged.push({ id: task.category, label: task.category });
    knownIds.add(task.category);
  }

  return merged;
}

export function buildGroupsByCategory(
  tasks: Task[],
  categories: CategoryOption[]
): Record<string, TaskGroup[]> {
  const resolvedCategories = categoriesForTasks(tasks, categories);
  const taskIds = new Set(tasks.map((task) => task.id));
  const map = Object.fromEntries(
    resolvedCategories.map((category) => [category.id, [] as TaskGroup[]])
  );

  for (const { id } of resolvedCategories) {
    const inCategory = tasks.filter((task) => task.category === id);

    const parents = inCategory
      .filter((task) => !task.parent_task_id)
      .sort((a, b) => a.sort_order - b.sort_order);

    const groups: TaskGroup[] = parents.map((parent) => ({
      parent,
      subtasks: inCategory
        .filter((task) => task.parent_task_id === parent.id)
        .sort((a, b) => a.sort_order - b.sort_order),
    }));

    const orphans = inCategory
      .filter((task) => task.parent_task_id && !taskIds.has(task.parent_task_id))
      .sort((a, b) => a.sort_order - b.sort_order);

    for (const orphan of orphans) {
      groups.push({ parent: orphan, subtasks: [] });
    }

    groups.sort((a, b) => a.parent.sort_order - b.parent.sort_order);
    map[id] = groups;
  }

  return map;
}

export function getVisibleCategories(tasks: Task[], categories: CategoryOption[]): CategoryOption[] {
  const groups = buildGroupsByCategory(tasks, categories);
  return categoriesForTasks(tasks, categories).filter(({ id }) => groups[id]?.length > 0);
}

export function getCategoryLabel(id: string, categories: CategoryOption[] = DEFAULT_CATEGORIES) {
  return categories.find((category) => category.id === id)?.label ?? id;
}

export function isCategoryColumnId(id: string, categories: CategoryOption[]) {
  return categories.some((category) => category.id === id);
}
