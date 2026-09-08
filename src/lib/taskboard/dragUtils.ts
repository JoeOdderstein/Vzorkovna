import type { Task, TaskGroup } from './types';
import type { TaskCategory } from './constants';

export type TaskReorderUpdate = {
  id: string;
  category: TaskCategory;
  sort_order: number;
  parent_task_id?: string | null;
};

export function computeMoveGroupUpdates(
  tasks: Task[],
  group: TaskGroup,
  toCategory: TaskCategory,
  overTaskId: string | null
): TaskReorderUpdate[] {
  const parentsInTarget = tasks
    .filter((t) => t.category === toCategory && !t.parent_task_id && t.id !== group.parent.id)
    .sort((a, b) => a.sort_order - b.sort_order);

  let toIndex: number;
  if (!overTaskId) {
    toIndex = parentsInTarget.length;
  } else {
    const allParentsInTarget = tasks
      .filter((t) => t.category === toCategory && !t.parent_task_id)
      .sort((a, b) => a.sort_order - b.sort_order);
    toIndex = allParentsInTarget.findIndex((p) => p.id === overTaskId);
    if (toIndex < 0) toIndex = parentsInTarget.length;
  }

  const updates: TaskReorderUpdate[] = [];
  updates.push({ id: group.parent.id, category: toCategory, sort_order: toIndex });
  group.subtasks.forEach((sub) => {
    updates.push({ id: sub.id, category: toCategory, sort_order: sub.sort_order });
  });
  parentsInTarget.forEach((p, i) => {
    const order = i >= toIndex ? i + 1 : i;
    updates.push({ id: p.id, category: toCategory, sort_order: order });
  });

  return updates;
}

export function applyTaskUpdates(tasks: Task[], updates: TaskReorderUpdate[]): Task[] {
  const map = new Map(updates.map((u) => [u.id, u]));
  return tasks.map((task) => {
    const update = map.get(task.id);
    if (!update) return task;
    return {
      ...task,
      category: update.category,
      sort_order: update.sort_order,
      ...(update.parent_task_id !== undefined ? { parent_task_id: update.parent_task_id } : {}),
    };
  });
}
