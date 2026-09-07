import type { Assignee, Priority, TaskCategory } from './constants';

export interface Project {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  parent_task_id: string | null;
  category: TaskCategory;
  task_name: string;
  description: string;
  assignees: Assignee[];
  priority: Priority;
  deadline: string | null;
  completed: boolean;
  completed_at: string | null;
  google_drive_url: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  project?: Pick<Project, 'id' | 'name' | 'slug'>;
}

export type TaskInsert = Pick<Task, 'project_id' | 'category'> &
  Partial<
    Pick<
      Task,
      | 'parent_task_id'
      | 'task_name'
      | 'description'
      | 'assignees'
      | 'priority'
      | 'deadline'
      | 'sort_order'
    >
  >;

export type TaskUpdate = Partial<
  Pick<
    Task,
    | 'category'
    | 'task_name'
    | 'description'
    | 'assignees'
    | 'priority'
    | 'deadline'
    | 'completed'
    | 'completed_at'
    | 'google_drive_url'
    | 'attachment_path'
    | 'attachment_name'
    | 'sort_order'
    | 'parent_task_id'
  >
>;

export interface TaskGroup {
  parent: Task;
  subtasks: Task[];
}
