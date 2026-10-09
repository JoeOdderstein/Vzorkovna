import { memo, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, ExternalLink } from 'lucide-react';
import CommentAuthorBlock from '../CommentAuthorBlock';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { formatAssignees } from '../../lib/taskboard/assigneeUtils';
import { formatCommentTimestamp } from '../../lib/taskboard/commentFormat';
import { fetchCategoriesForProject } from '../../lib/taskboard/categoryService';
import { DEFAULT_CATEGORIES } from '../../lib/taskboard/categoryUtils';
import type { TaskCategory } from '../../lib/taskboard/constants';
import {
  deleteTeamMessage,
  updateTeamMessage,
} from '../../lib/messages/teamMessageService';
import type { TeamMessage } from '../../lib/messages/types';
import type { CategoryOption, Project } from '../../lib/taskboard/types';
import { translateCategoryLabel } from '../../lib/taskboard/i18n/messages';
import CategorySelect from '../../taskboard/components/CategorySelect';
import MessageBodyContent from './MessageBodyContent';
import MessageRichTextEditor from './MessageRichTextEditor';
import { fetchMessageFeedSummary } from '../../lib/messages/messageFeedSummary';
import {
  htmlMessageHasContent,
  normalizeOutgoingMessageBody,
} from '../../lib/messages/messageRichText';

function taskboardHref(task: NonNullable<TeamMessage['linked_task']>) {
  return task.project?.slug != null
    ? `/taskboard?open=${encodeURIComponent(task.project.slug)}&task=${encodeURIComponent(task.id)}`
    : `/taskboard?task=${encodeURIComponent(task.id)}`;
}

function authorUsernamesMatch(stored: string, actor: string) {
  return stored.trim().toLowerCase() === actor.trim().toLowerCase();
}

interface MessageRowProps {
  message: TeamMessage;
  locale: 'en' | 'uk';
  currentUsername: string | null;
  projects: Project[];
  isAdmin: boolean;
  onMutated: () => void;
  onDeleted?: (messageId: string) => void;
}

function MessageRow({
  message,
  locale,
  currentUsername,
  projects,
  isAdmin,
  onMutated,
  onDeleted,
}: MessageRowProps) {
  const { t } = useTaskboardI18n();
  const canEdit =
    Boolean(currentUsername) &&
    authorUsernamesMatch(message.author_username, currentUsername ?? '');

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(message.title);
  const [editBody, setEditBody] = useState(message.body);
  const [editProjectId, setEditProjectId] = useState(message.project_id ?? '');
  const [editCategory, setEditCategory] = useState<TaskCategory>(
    message.category ?? 'quotations'
  );
  const [editCategories, setEditCategories] = useState<CategoryOption[]>(DEFAULT_CATEGORIES);
  const [loadingEditCategories, setLoadingEditCategories] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState('');

  const authorLabel = message.author_display_name || message.author_username;
  const linkedTasks =
    message.linked_tasks?.length ? message.linked_tasks : message.linked_task ? [message.linked_task] : [];
  const displayTitle = message.title.trim() || t('task.untitled');
  const categoryLabel = message.category
    ? translateCategoryLabel(locale, message.category, message.category)
    : null;

  const localizedEditCategories = useMemo(
    () =>
      editCategories.map((item) => ({
        ...item,
        label: translateCategoryLabel(locale, item.id, item.label),
      })),
    [editCategories, locale]
  );

  useEffect(() => {
    if (!editing || !editProjectId) return;
    setLoadingEditCategories(true);
    void fetchCategoriesForProject(editProjectId)
      .then((list) => {
        setEditCategories(list);
        setEditCategory((current) =>
          list.some((item) => item.id === current) ? current : list[0]?.id ?? 'quotations'
        );
      })
      .catch(() => setEditCategories(DEFAULT_CATEGORIES))
      .finally(() => setLoadingEditCategories(false));
  }, [editing, editProjectId]);

  const startEdit = () => {
    setEditTitle(message.title);
    setEditBody(message.body);
    setEditProjectId(message.project_id ?? projects[0]?.id ?? '');
    setEditCategory(message.category ?? 'quotations');
    setActionError('');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setActionError('');
  };

  const saveEdit = async () => {
    if (!currentUsername) return;
    const title = editTitle.trim();
    const body = normalizeOutgoingMessageBody(editBody);
    if (!title) {
      setActionError(t('messages.messageTitleRequired'));
      return;
    }
    if (!htmlMessageHasContent(body)) {
      setActionError(t('messages.bodyRequired'));
      return;
    }
    if (!editProjectId) {
      setActionError(t('messages.messageProjectRequired'));
      return;
    }

    setSaving(true);
    setActionError('');
    try {
      await updateTeamMessage(
        message.id,
        {
          title,
          body,
          projectId: editProjectId,
          category: editCategory,
        },
        currentUsername
      );
      setEditing(false);
      onMutated();
      void fetchMessageFeedSummary(message.id, { force: true }).catch(() => {});
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('messages.editError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentUsername || deleting || saving) return;
    if (!window.confirm(t('messages.deleteConfirm'))) return;
    setDeleting(true);
    setActionError('');
    try {
      await deleteTeamMessage(message.id, currentUsername);
      onDeleted?.(message.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('messages.deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <li>
      <CommentAuthorBlock username={message.author_username}>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1">
          <span className="text-sm font-semibold">{authorLabel}</span>
          <time className="text-xs tb-muted" dateTime={message.created_at}>
            {formatCommentTimestamp(message.created_at)}
          </time>
          {canEdit && !editing ? (
            <span className="inline-flex items-center gap-2 text-xs ml-auto">
              <button
                type="button"
                onClick={startEdit}
                disabled={deleting}
                className="tb-link hover:underline disabled:opacity-50"
              >
                {t('comments.edit')}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="text-red-600 hover:underline disabled:opacity-50"
              >
                {deleting ? t('messages.deleting') : t('comments.delete')}
              </button>
            </span>
          ) : null}
        </div>

        {editing ? (
          <div className="space-y-3 mt-2">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="field-input w-full text-sm"
              disabled={saving}
              aria-label={t('messages.messageTitle')}
            />
            {projects.length > 0 ? (
              <select
                value={editProjectId}
                onChange={(e) => setEditProjectId(e.target.value)}
                className="field-input w-full text-sm"
                disabled={saving}
                aria-label={t('addTask.chooseProject')}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            ) : null}
            {loadingEditCategories ? (
              <p className="text-xs tb-muted">{t('addTask.loadingCategories')}</p>
            ) : (
              <CategorySelect
                id={`message-edit-category-${message.id}`}
                categories={localizedEditCategories}
                value={editCategory}
                onChange={setEditCategory}
                className="field-input w-full text-sm"
                isAdmin={isAdmin}
              />
            )}
            <MessageRichTextEditor
              key={message.id}
              username={currentUsername ?? ''}
              value={editBody}
              onChange={setEditBody}
              disabled={saving}
              minHeightClassName="min-h-[5rem]"
              aria-label={t('task.description')}
            />
            {actionError ? <p className="text-xs text-red-600">{actionError}</p> : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={saving}
                className="tb-btn-primary text-sm px-3 py-1.5 disabled:opacity-50"
              >
                {saving ? t('comments.saving') : t('common.save')}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="tb-btn-secondary text-sm px-3 py-1.5 disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="text-base font-semibold min-w-0 flex-1 leading-snug">
                {displayTitle}
              </h3>
              {message.project?.name || categoryLabel ? (
                <p
                  className="text-xs tb-muted shrink-0 max-w-[min(100%,14rem)] text-right leading-snug"
                  title={
                    message.project?.name || categoryLabel
                      ? `${message.project?.name ?? t('common.project')}${
                          categoryLabel ? ` · ${categoryLabel}` : ''
                        }`
                      : undefined
                  }
                >
                  <span className="block truncate">
                    {message.project?.name ?? t('common.project')}
                    {categoryLabel ? ` · ${categoryLabel}` : null}
                  </span>
                </p>
              ) : null}
            </div>
            <MessageBodyContent
              messageId={message.id}
              title={displayTitle}
              body={message.body}
              feedSummary={message.feed_summary}
            />
          </>
        )}

        {!editing && actionError ? (
          <p className="text-xs text-red-600 mt-2">{actionError}</p>
        ) : null}

        {linkedTasks.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {linkedTasks.map((task) => (
              <li
                key={task.id}
                className="rounded-lg border border-[var(--tb-border)] bg-[var(--tb-surface-muted)]/50 px-3 py-2.5"
              >
                <div className="flex items-start gap-2">
                  <CheckSquare
                    size={18}
                    className="shrink-0 mt-0.5 text-[var(--tb-accent)]"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs tb-muted uppercase tracking-wide mb-0.5">
                      {t('messages.actionPointCreated')}
                    </p>
                    <p className="text-sm font-medium">{task.task_name}</p>
                    <p className="text-xs tb-muted mt-1">
                      {task.project?.name ? `${task.project.name}` : null}
                      {task.assignees.length > 0 ? (
                        <>
                          {task.project?.name ? ' · ' : null}
                          {formatAssignees(task.assignees)}
                        </>
                      ) : null}
                    </p>
                    <Link
                      to={taskboardHref(task)}
                      className="inline-flex items-center gap-1 text-sm text-[var(--tb-accent)] hover:underline mt-2"
                    >
                      {t('messages.openOnTaskboard')}
                      <ExternalLink size={14} aria-hidden />
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </CommentAuthorBlock>
    </li>
  );
}

export default memo(MessageRow);
