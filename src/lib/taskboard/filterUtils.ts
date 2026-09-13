import { ASSIGNEES, type Assignee, type Priority } from './constants';
import type { Project, Task } from './types';
import { taskHasAssignee } from './assigneeUtils';

export type AssigneeFilter = 'all' | Assignee;

const PRIORITY_WEIGHT: Record<Priority, number> = {
  high: 3,
  normal: 2,
  low: 1,
};

export const ASSIGNEE_FILTERS: { id: AssigneeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  ...[...ASSIGNEES].sort((a, b) => a.localeCompare(b)).map((id) => ({ id, label: id })),
];

const ASSIGNEE_FILTER_ITEMS = ASSIGNEE_FILTERS.filter(
  (filter): filter is { id: Assignee; label: string } => filter.id !== 'all'
);

/** All first, logged-in assignee second, then others by open-task count (desc). */
export function orderAssigneeFiltersForUser(
  currentAssignee: Assignee | null,
  counts: Record<AssigneeFilter, number>
): { id: AssigneeFilter; label: string }[] {
  const allFilter = ASSIGNEE_FILTERS[0];
  const others = [...ASSIGNEE_FILTER_ITEMS]
    .filter((filter) => filter.id !== currentAssignee)
    .sort((a, b) => {
      const countDiff = (counts[b.id] ?? 0) - (counts[a.id] ?? 0);
      if (countDiff !== 0) return countDiff;
      return a.label.localeCompare(b.label);
    });

  if (currentAssignee) {
    const currentFilter = ASSIGNEE_FILTER_ITEMS.find((filter) => filter.id === currentAssignee);
    if (currentFilter) return [allFilter, currentFilter, ...others];
  }

  return [allFilter, ...others];
}

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

function visibleProjectTasks(tasks: Task[], projectId: string, filter: AssigneeFilter) {
  const projectTasks = tasks.filter((t) => t.project_id === projectId && !t.completed);
  if (filter === 'all') return projectTasks;
  return projectTasks.filter((t) => taskHasAssignee(t, filter));
}

function projectPriorityScore(tasks: Task[]) {
  return tasks.reduce((sum, task) => sum + PRIORITY_WEIGHT[task.priority], 0);
}

/** Most open tasks first, then highest combined priority, then original sort order. */
export function sortProjectsByWorkload(
  projects: Project[],
  tasks: Task[],
  filter: AssigneeFilter
): Project[] {
  return [...projects].sort((a, b) => {
    const aTasks = visibleProjectTasks(tasks, a.id, filter);
    const bTasks = visibleProjectTasks(tasks, b.id, filter);

    const countDiff = bTasks.length - aTasks.length;
    if (countDiff !== 0) return countDiff;

    const priorityDiff = projectPriorityScore(bTasks) - projectPriorityScore(aTasks);
    if (priorityDiff !== 0) return priorityDiff;

    return a.sort_order - b.sort_order;
  });
}
