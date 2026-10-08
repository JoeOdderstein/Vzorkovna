import type { Assignee } from '../taskboard/constants';
import type { TaskCategory } from '../taskboard/constants';

export interface TeamMessageLinkedTask {
  id: string;
  task_name: string;
  assignees: Assignee[];
  project?: { name: string; slug: string } | null;
}

export interface TeamMessage {
  id: string;
  body: string;
  author_username: string;
  author_display_name: string;
  linked_task_id: string | null;
  created_at: string;
  linked_task?: TeamMessageLinkedTask | null;
}

export interface TeamMessageActionPoint {
  taskName: string;
  projectId: string;
  category: TaskCategory;
  assignees: Assignee[];
}

export interface CreateTeamMessageInput {
  body: string;
  author: { username: string; displayName: string };
  actionPoint?: TeamMessageActionPoint | null;
}
