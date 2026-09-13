import type { Assignee, Priority, TaskCategory } from './constants';

export interface CategoryOption {
  id: TaskCategory;
  label: string;
  isCustom?: boolean;
}

export interface ProjectCategory {
  id: string;
  project_id: string;
  slug: string;
  label: string;
  sort_order: number;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  created_at: string;
  /** NULL = all users; [] = admin only; otherwise listed usernames + admin */
  visible_to?: string[] | null;
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

export interface CalendarEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

export type CalendarEventInsert = Pick<CalendarEvent, 'title' | 'start_date' | 'end_date'>;

export type UserProfileTheme = 'light' | 'dark';

export interface UserProfile {
  username: string;
  /** Personal name on the taskboard and in assignment emails. */
  board_name: string | null;
  email: string | null;
  theme: UserProfileTheme;
  notify_on_assign: boolean;
  created_at: string;
  updated_at: string;
}

export type UserProfileUpdate = Partial<
  Pick<UserProfile, 'board_name' | 'email' | 'theme' | 'notify_on_assign'>
>;
