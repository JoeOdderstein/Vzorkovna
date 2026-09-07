import type { Assignee } from './constants';
import type { Task } from './types';
import { taskHasAssignee } from './assigneeUtils';

export type AssigneeFilter = 'all' | Assignee;

export const ASSIGNEE_FILTERS: { id: AssigneeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'Joost', label: 'Joost' },
  { id: 'Gus', label: 'Gus' },
  { id: 'Pasha', label: 'Pasha' },
];

export function filterTasksByAssignee(tasks: Task[], filter: AssigneeFilter): Task[] {
  if (filter === 'all') return tasks;

  return tasks.filter((task) => {
    if (taskHasAssignee(task, filter)) return true;
    if (!task.parent_task_id) {
      return tasks.some(
        (sub) => sub.parent_task_id === task.id && taskHasAssignee(sub, filter)
      );
    }
    return false;
  });
}

export function countProjectTasksForFilter(tasks: Task[], projectId: string, filter: AssigneeFilter) {
  const projectTasks = tasks.filter((t) => t.project_id === projectId && !t.completed);
  if (filter === 'all') return projectTasks.length;
  return projectTasks.filter((t) => taskHasAssignee(t, filter)).length;
}
