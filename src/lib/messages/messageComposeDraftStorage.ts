import type { Assignee, TaskCategory } from '../taskboard/constants';
import { htmlMessageHasContent, prepareMessageComposeDraftBody } from './messageRichText';
import type { ActionPointDraft, MessageComposeAttachment } from './types';

const STORAGE_PREFIX = 'team_message_compose_draft_v1';

export type MessageComposeDraft = {
  title: string;
  body: string;
  messageProjectId: string;
  messageCategory: TaskCategory;
  addAction: boolean;
  actionTitle: string;
  projectId: string;
  category: TaskCategory;
  actionCategoryOverride?: TaskCategory;
  assignees: Assignee[];
  actionDrafts: ActionPointDraft[];
  attachments: MessageComposeAttachment[];
  excludedNotifyUsernames: string[];
  expanded: boolean;
  savedAt: string;
};

function storageKey(username: string): string {
  return `${STORAGE_PREFIX}:${username.trim().toLowerCase()}`;
}

export function isComposeDraftEmpty(draft: MessageComposeDraft): boolean {
  if (draft.title.trim()) return false;
  if (htmlMessageHasContent(draft.body)) return false;
  if (draft.actionDrafts.length > 0) return false;
  if (draft.attachments?.length > 0) return false;
  if (draft.addAction && (draft.actionTitle.trim() || draft.assignees.length > 0)) return false;
  return true;
}

export function loadMessageComposeDraft(username: string): MessageComposeDraft | null {
  if (!username.trim() || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(username));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MessageComposeDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    const draft: MessageComposeDraft = {
      title: String(parsed.title ?? ''),
      body: prepareMessageComposeDraftBody(String(parsed.body ?? '')),
      messageProjectId: String(parsed.messageProjectId ?? ''),
      messageCategory: (parsed.messageCategory ?? 'quotations') as TaskCategory,
      addAction: Boolean(parsed.addAction),
      actionTitle: String(parsed.actionTitle ?? ''),
      projectId: String(parsed.projectId ?? ''),
      category: (parsed.category ?? 'quotations') as TaskCategory,
      actionCategoryOverride:
        typeof parsed.actionCategoryOverride === 'string'
          ? (parsed.actionCategoryOverride as TaskCategory)
          : undefined,
      assignees: Array.isArray(parsed.assignees) ? parsed.assignees : [],
      actionDrafts: Array.isArray(parsed.actionDrafts) ? parsed.actionDrafts : [],
      attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
      excludedNotifyUsernames: Array.isArray(parsed.excludedNotifyUsernames)
        ? parsed.excludedNotifyUsernames.map(String)
        : [],
      expanded: Boolean(parsed.expanded),
      savedAt: String(parsed.savedAt ?? ''),
    };
    return isComposeDraftEmpty(draft) ? null : draft;
  } catch {
    return null;
  }
}

export function saveMessageComposeDraft(username: string, draft: MessageComposeDraft): void {
  if (!username.trim() || typeof localStorage === 'undefined') return;
  if (isComposeDraftEmpty(draft)) {
    clearMessageComposeDraft(username);
    return;
  }
  try {
    localStorage.setItem(
      storageKey(username),
      JSON.stringify({ ...draft, savedAt: new Date().toISOString() })
    );
  } catch {
    // Quota or private mode — ignore
  }
}

export function clearMessageComposeDraft(username: string): void {
  if (!username.trim() || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(username));
  } catch {
    // ignore
  }
}
