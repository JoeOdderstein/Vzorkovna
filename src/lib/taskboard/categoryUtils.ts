import { TASK_CATEGORIES, type TaskCategory } from './constants';
import type { Task } from './types';

export function getVisibleCategories(tasks: Task[]): { id: TaskCategory; label: string }[] {
  return TASK_CATEGORIES.filter(({ id }) => tasks.some((task) => task.category === id));
}

export function getCategoryLabel(id: TaskCategory) {
  return TASK_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
