import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, ExternalLink } from 'lucide-react';
import CommentAuthorBlock from '../CommentAuthorBlock';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { useAssigneeNames } from '../../hooks/useAssigneeNames';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { defaultBoardNameForUsername } from '../../lib/taskboard/boardNameUtils';
import { toggleAssignee } from '../../lib/taskboard/assigneeUtils';
import { formatAssignees } from '../../lib/taskboard/assigneeUtils';
import { fetchCategoriesForProject } from '../../lib/taskboard/categoryService';
import { DEFAULT_CATEGORIES } from '../../lib/taskboard/categoryUtils';
import type { Assignee, TaskCategory } from '../../lib/taskboard/constants';
import { formatCommentTimestamp } from '../../lib/taskboard/commentFormat';
import {
  createTeamMessage,
  fetchTeamMessages,
  isTeamMessagesReady,
  subscribeToTeamMessages,
} from '../../lib/messages/teamMessageService';
import type { TeamMessage } from '../../lib/messages/types';
import { fetchVisibleProjects } from '../../lib/taskboard/taskService';
import type { CategoryOption, Project } from '../../lib/taskboard/types';
import CategorySelect from '../../taskboard/components/CategorySelect';
import { translateCategoryLabel } from '../../lib/taskboard/i18n/messages';

export default function MessagesPanel() {
  const { username, isAdmin } = useTaskboardAuth();
  const { profile } = useUserProfile();
  const assigneeNames = useAssigneeNames();
  const { t, locale } = useTaskboardI18n();

  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(true);
  const [error, setError] = useState('');

  const [body, setBody] = useState('');
  const [addAction, setAddAction] = useState(false);
  const [actionTitle, setActionTitle] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [category, setCategory] = useState<TaskCategory>('quotations');
  const [categories, setCategories] = useState<CategoryOption[]>(DEFAULT_CATEGORIES);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const feedEndRef = useRef<HTMLDivElement>(null);

  const displayName = useMemo(() => {
    if (profile?.board_name?.trim()) return profile.board_name.trim();
    if (username) return defaultBoardNameForUsername(username);
    return '';
  }, [profile?.board_name, username]);

  const localizedCategories = useMemo(
    () =>
      categories.map((item) => ({
        ...item,
        label: translateCategoryLabel(locale, item.id, item.label),
      })),
    [categories, locale]
  );

  const reload = useCallback(async () => {
    try {
      const rows = await fetchTeamMessages();
      setMessages(rows);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('messages.loadError'));
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void isTeamMessagesReady()
      .then((ok) => {
        if (cancelled) return;
        setReady(ok);
        if (!ok) {
          setLoading(false);
          return;
        }
        return reload();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  useEffect(() => {
    if (!ready) return;
    return subscribeToTeamMessages(() => {
      void reload();
    });
  }, [ready, reload]);

  useEffect(() => {
    if (!username) return;
    void fetchVisibleProjects(username, isAdmin)
      .then((list) => {
        setProjects(list);
        setProjectId((current) =>
          current && list.some((p) => p.id === current) ? current : list[0]?.id ?? ''
        );
      })
      .catch(() => setProjects([]));
  }, [username, isAdmin]);

  useEffect(() => {
    if (!projectId) return;
    void fetchCategoriesForProject(projectId)
      .then((list) => {
        setCategories(list);
        setCategory((current) =>
          list.some((item) => item.id === current) ? current : list[0]?.id ?? 'quotations'
        );
      })
      .catch(() => setCategories(DEFAULT_CATEGORIES));
  }, [projectId]);

  useEffect(() => {
    if (messages.length === 0) return;
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || !username) return;

    if (addAction) {
      if (!actionTitle.trim()) {
        setError(t('messages.actionTitleRequired'));
        return;
      }
      if (!projectId) {
        setError(t('messages.projectRequired'));
        return;
      }
      if (assignees.length === 0) {
        setError(t('messages.assigneeRequired'));
        return;
      }
    }

    setSubmitting(true);
    setError('');
    try {
      await createTeamMessage({
        body: trimmed,
        author: { username, displayName },
        actionPoint: addAction
          ? {
              taskName: actionTitle.trim(),
              projectId,
              category,
              assignees,
            }
          : null,
      });
      setBody('');
      setActionTitle('');
      setAssignees([]);
      setAddAction(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('messages.postError'));
    } finally {
      setSubmitting(false);
    }
  };

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !addAction) {
      e.preventDefault();
      if (!submitting && body.trim()) void handleSubmit(e as unknown as FormEvent);
    }
  };

  if (!ready) {
    return (
      <section className="tb-remote-inst-card p-6 md:p-8">
        <p className="text-sm tb-muted">{t('messages.notConfigured')}</p>
        <p className="text-sm tb-muted mt-2">
          Run <code className="text-xs">supabase/migrations/026_team_messages.sql</code> in your
          Supabase SQL editor.
        </p>
      </section>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-8">
        <span className="tb-label block mb-2">{t('nav.remoteInst')}</span>
        <p className="text-sm tb-muted">{t('messages.pageDescription')}</p>
      </header>

      <section className="tb-remote-inst-card p-4 md:p-6 mb-6 max-h-[min(52vh,520px)] overflow-y-auto">
        {loading && messages.length === 0 ? (
          <p className="text-sm tb-muted">{t('messages.loading')}</p>
        ) : null}
        {!loading && messages.length === 0 ? (
          <p className="text-sm tb-muted">{t('messages.empty')}</p>
        ) : null}
        <ul className="space-y-4">
          {messages.map((message) => (
            <MessageRow key={message.id} message={message} />
          ))}
        </ul>
        <div ref={feedEndRef} />
      </section>

      <form onSubmit={handleSubmit} className="tb-remote-inst-card p-4 md:p-6 space-y-4">
        <label className="block">
          <span className="tb-field-label mb-2 block">{t('messages.composeLabel')}</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onComposerKeyDown}
            rows={4}
            className="field-input w-full resize-y min-h-[6rem]"
            placeholder={t('messages.composePlaceholder')}
            disabled={submitting}
          />
          <span className="text-xs tb-muted mt-1 block">{t('messages.composeHint')}</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={addAction}
            onChange={(e) => setAddAction(e.target.checked)}
            className="rounded border-[var(--tb-border)]"
            disabled={submitting}
          />
          <span className="text-sm font-medium">{t('messages.addActionPoint')}</span>
        </label>

        {addAction ? (
          <div className="space-y-4 pl-0 sm:pl-6 border-l-2 border-[var(--tb-accent)]/30 ml-1">
            <label className="block">
              <span className="tb-field-label mb-2 block">{t('messages.actionTitle')}</span>
              <input
                type="text"
                value={actionTitle}
                onChange={(e) => setActionTitle(e.target.value)}
                className="field-input w-full"
                placeholder={t('messages.actionTitlePlaceholder')}
                disabled={submitting}
              />
            </label>

            <div>
              <span className="tb-field-label mb-2 block">{t('common.project')}</span>
              {projects.length === 0 ? (
                <p className="text-sm tb-muted">{t('messages.noProjects')}</p>
              ) : (
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="field-input w-full"
                  disabled={submitting}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <span className="tb-field-label mb-2 block">{t('task.category')}</span>
              <CategorySelect
                id="messages-action-category"
                categories={localizedCategories}
                value={category}
                onChange={setCategory}
                className="field-input w-full"
              />
            </div>

            <div>
              <span className="tb-field-label mb-2 block">{t('task.assignedTo')}</span>
              <div className="flex flex-wrap gap-2">
                {assigneeNames.map((name) => {
                  const selected = assignees.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setAssignees((prev) => toggleAssignee(prev, name))}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        selected ? 'tb-pill-selected font-medium' : 'tb-pill'
                      }`}
                      disabled={submitting}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex justify-end">
          <button type="submit" className="tb-btn-primary" disabled={submitting || !body.trim()}>
            {submitting ? t('messages.posting') : t('messages.post')}
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageRow({ message }: { message: TeamMessage }) {
  const { t } = useTaskboardI18n();
  const authorLabel = message.author_display_name || message.author_username;
  const task = message.linked_task;
  const taskHref =
    task?.project?.slug != null
      ? `/taskboard?open=${encodeURIComponent(task.project.slug)}&task=${encodeURIComponent(task.id)}`
      : task
        ? `/taskboard?task=${encodeURIComponent(task.id)}`
        : null;

  return (
    <li>
      <CommentAuthorBlock username={message.author_username}>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1">
          <span className="text-sm font-semibold">{authorLabel}</span>
          <time className="text-xs tb-muted" dateTime={message.created_at}>
            {formatCommentTimestamp(message.created_at)}
          </time>
        </div>
        <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>

        {task && taskHref ? (
          <div className="mt-3 rounded-lg border border-[var(--tb-border)] bg-[var(--tb-surface-muted)]/50 px-3 py-2.5">
            <div className="flex items-start gap-2">
              <CheckSquare size={18} className="shrink-0 mt-0.5 text-[var(--tb-accent)]" aria-hidden />
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
                  to={taskHref}
                  className="inline-flex items-center gap-1 text-sm text-[var(--tb-accent)] hover:underline mt-2"
                >
                  {t('messages.openOnTaskboard')}
                  <ExternalLink size={14} aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </CommentAuthorBlock>
    </li>
  );
}
