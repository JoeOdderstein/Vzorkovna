import type { Assignee } from '../taskboard/constants';
import type { TaskCategory } from '../taskboard/constants';

export interface TeamMessageLinkedTask {
  id: string;
  task_name: string;
  assignees: Assignee[];
  project?: { name: string; slug: string } | null;
}

export interface TeamMessageProject {
  id: string;
  name: string;
  slug: string;
}

export interface TeamMessage {
  id: string;
  title: string;
  body: string;
  project_id: string | null;
  category: TaskCategory | null;
  author_username: string;
  author_display_name: string;
  linked_task_id: string | null;
  linked_task_ids?: string[];
  created_at: string;
  project?: TeamMessageProject | null;
  linked_task?: TeamMessageLinkedTask | null;
  linked_tasks?: TeamMessageLinkedTask[];
}

export interface TeamMessageActionPoint {
  taskName: string;
  projectId: string;
  category: TaskCategory;
  assignees: Assignee[];
}

export interface CreateTeamMessageInput {
  title: string;
  body: string;
  projectId: string;
  category: TaskCategory;
  author: { username: string; displayName: string };
  actionPoint?: TeamMessageActionPoint | null;
  actionPoints?: TeamMessageActionPoint[];
}

export interface UpdateTeamMessageInput {
  title: string;
  body: string;
  projectId: string;
  category: TaskCategory;
}

export type ActionPointDraft = TeamMessageActionPoint & {
  draftId: string;
  enabled: boolean;
  /** When set, task category differs from the message category. */
  categoryOverride?: TaskCategory;
};

export type MessageComposeAttachment = {
  id: string;
  fileName: string;
  storagePath: string;
  size: number;
  contentType: string;
};
