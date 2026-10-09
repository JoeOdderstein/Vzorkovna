import { FormEvent, memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, PenLine, X } from 'lucide-react';
import { useTaskboardTheme } from '../../context/TaskboardThemeContext';
import { useMessagesCompose } from '../../context/MessagesComposeContext';
import type { TaskCategory } from '../../lib/taskboard/constants';
import {
  fetchCategoriesForProject,
  peekCategoriesForProject,
  prefetchCategoriesForProjects,
} from '../../lib/taskboard/categoryService';
import { DEFAULT_CATEGORIES } from '../../lib/taskboard/categoryUtils';
import { createTeamMessage } from '../../lib/messages/teamMessageService';
import { isLocalTaskboardMode } from '../../lib/taskboard/taskService';
import {
  matchCategoryFromTitle,
  matchProjectFromTitle,
  suggestMessageProjectFromTitle,
  titleNeedsAiProjectSuggest,
} from '../../lib/messages/suggestMessageProject';
import { parseActionPointsFromText } from '../../lib/messages/parseActionPoints';
import {
  htmlMessageHasContent,
  messageBodyToPlainText,
  normalizeOutgoingMessageBody,
} from '../../lib/messages/messageRichText';
import { appendMessageAttachmentsHtml } from '../../lib/messages/messageAttachmentHtml';
import type { ActionPointDraft, MessageComposeAttachment, TeamMessage } from '../../lib/messages/types';
import MessageComposeAttachments from './MessageComposeAttachments';
import MessageComposeNotificationRecipients from './MessageComposeNotificationRecipients';
import { notifyTeamMessagePosted } from '../../lib/messages/notifyTeamMessage';
import type { CategoryOption, Project } from '../../lib/taskboard/types';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import MessageComposeSuggestChips from './MessageComposeSuggestChips';
import {
  buildAssigneeOptionsFromNames,
  type TaskboardAssigneeOption,
} from './MessageActionPointFields';
import ActionPointsDraftEditor from './ActionPointsDraftEditor';
import MessageRichTextEditor from './MessageRichTextEditor';
import { useDebouncedTitleInput } from './useDebouncedTitleInput';
import {
  clearMessageComposeDraft,
  loadMessageComposeDraft,
  saveMessageComposeDraft,
  type MessageComposeDraft,
} from '../../lib/messages/messageComposeDraftStorage';

const SUGGEST_DEBOUNCE_MS = 900;
const DRAFT_SAVE_DEBOUNCE_MS = 650;

function createBlankActionDraft(
  projectId: string,
  category: TaskCategory
): ActionPointDraft {
  return {
    draftId: crypto.randomUUID(),
    enabled: true,
    taskName: '',
    projectId,
    category,
    assignees: [],
  };
}

interface MessageComposeFormProps {
  username: string;
  displayName: string;
  isAdmin: boolean;
  projects: Project[];
  loadingProjects: boolean;
  assigneeOptions: TaskboardAssigneeOption[];
  loadingTeam: boolean;
  teamReady: boolean;
  onPosted: (created: TeamMessage) => Promise<void>;
  onProjectsReplace: (projects: Project[]) => void;
  onAssigneeOptionsReplace: (options: TaskboardAssigneeOption[]) => void;
  reloadTaskboardContext: () => Promise<{
    projects: Project[];
    assigneeOptions: TaskboardAssigneeOption[];
  }>;
}

function MessageComposeForm({
  username,
  displayName,
  isAdmin,
  projects,
  loadingProjects,
  assigneeOptions,
  loadingTeam,
  teamReady,
  onPosted,
  onProjectsReplace,
  onAssigneeOptionsReplace,
  reloadTaskboardContext,
}: MessageComposeFormProps) {
  const { t } = useTaskboardI18n();
  const { theme } = useTaskboardTheme();
  const { setDrawerOpen, notifyComposeWillOpen } = useMessagesCompose();
  const { inputRef: titleInputRef, debouncedTitle, hasContent, getTitle, clearTitle, setTitle } =
    useDebouncedTitleInput(SUGGEST_DEBOUNCE_MS);

  const [body, setBody] = useState('');
  const [messageProjectId, setMessageProjectId] = useState('');
  const [messageCategory, setMessageCategory] = useState<TaskCategory>('quotations');
  const [messageCategories, setMessageCategories] = useState<CategoryOption[]>(DEFAULT_CATEGORIES);
  const [loadingMessageCategories, setLoadingMessageCategories] = useState(false);
  const [actionDrafts, setActionDrafts] = useState<ActionPointDraft[]>([]);
  const [attachments, setAttachments] = useState<MessageComposeAttachment[]>([]);
  const [excludedNotifyUsernames, setExcludedNotifyUsernames] = useState<string[]>([]);
  const [actionDraftsFromAi, setActionDraftsFromAi] = useState(false);
  const [parsingAi, setParsingAi] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [suggestingAi, setSuggestingAi] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const manualComposePickRef = useRef({ project: false, category: false });
  const suggestRequestIdRef = useRef(0);
  const projectsRef = useRef(projects);
  const lastAppliedSuggestTitleRef = useRef('');
  const draftReadyRef = useRef(false);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  projectsRef.current = projects;

  useEffect(() => {
    draftReadyRef.current = false;
    const stored = loadMessageComposeDraft(username);
    if (stored) {
      setTitle(stored.title);
      setBody(stored.body);
      setMessageProjectId(stored.messageProjectId);
      setMessageCategory(stored.messageCategory);
      let drafts = Array.isArray(stored.actionDrafts) ? stored.actionDrafts : [];
      if (
        drafts.length === 0 &&
        stored.addAction &&
        (stored.actionTitle.trim() || stored.assignees.length > 0)
      ) {
        drafts = [
          {
            draftId: crypto.randomUUID(),
            enabled: true,
            taskName: stored.actionTitle,
            projectId: stored.messageProjectId || stored.projectId,
            category: stored.messageCategory,
            categoryOverride: stored.actionCategoryOverride,
            assignees: stored.assignees,
          },
        ];
      }
      setActionDrafts(drafts);
      setAttachments(Array.isArray(stored.attachments) ? stored.attachments : []);
      setExcludedNotifyUsernames(
        Array.isArray(stored.excludedNotifyUsernames) ? stored.excludedNotifyUsernames : []
      );
      setActionDraftsFromAi(false);
      const shouldExpand =
        stored.expanded || Boolean(stored.title.trim()) || htmlMessageHasContent(stored.body);
      setExpanded(shouldExpand);
      if (shouldExpand) {
        setDrawerOpen(true);
      }
      if (stored.messageProjectId || stored.messageCategory) {
        manualComposePickRef.current = { project: true, category: true };
      }
      lastAppliedSuggestTitleRef.current = stored.title.trim();
    }
    draftReadyRef.current = true;
  }, [username, setTitle, setDrawerOpen]);

  useEffect(() => {
    if (!draftReadyRef.current || !username) return;

    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => {
      draftSaveTimerRef.current = null;
      const draft: MessageComposeDraft = {
        title: getTitle(),
        body,
        messageProjectId,
        messageCategory,
        addAction: actionDrafts.length > 0,
        actionTitle: '',
        projectId: messageProjectId,
        category: messageCategory,
        actionCategoryOverride: undefined,
        assignees: [],
        actionDrafts,
        attachments,
        excludedNotifyUsernames,
        expanded,
        savedAt: new Date().toISOString(),
      };
      saveMessageComposeDraft(username, draft);
    }, DRAFT_SAVE_DEBOUNCE_MS);

    return () => {
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    };
  }, [
    username,
    debouncedTitle,
    hasContent,
    body,
    messageProjectId,
    messageCategory,
    actionDrafts,
    attachments,
    excludedNotifyUsernames,
    expanded,
    getTitle,
  ]);

  const hasDraft =
    hasContent ||
    htmlMessageHasContent(body) ||
    actionDrafts.length > 0 ||
    attachments.length > 0 ||
    Boolean(messageProjectId);

  const appendActionDraft = useCallback(() => {
    if (!messageProjectId) {
      setError(t('messages.messageProjectRequired'));
      return;
    }
    setError('');
    setActionDrafts((prev) => [
      ...prev,
      createBlankActionDraft(messageProjectId, messageCategory),
    ]);
  }, [messageProjectId, messageCategory, t]);

  useEffect(() => {
    setDrawerOpen(expanded);
  }, [expanded, setDrawerOpen]);

  const openCompose = useCallback(() => {
    notifyComposeWillOpen();
    setDrawerOpen(true);
    setExpanded(true);
  }, [notifyComposeWillOpen, setDrawerOpen]);

  const closeCompose = useCallback(() => {
    notifyComposeWillOpen();
    setDrawerOpen(false);
    setExpanded(false);
  }, [notifyComposeWillOpen, setDrawerOpen]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCompose();
    };
    window.addEventListener('keydown', onKey);
    const id = requestAnimationFrame(() => {
      titleInputRef.current?.focus({ preventScroll: true });
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(id);
    };
  }, [expanded, titleInputRef, closeCompose]);

  useEffect(() => {
    if (projects.length === 0) return;
    prefetchCategoriesForProjects(projects.map((p) => p.id));
  }, [projects]);

  useEffect(() => {
    if (!messageProjectId) return;

    const applyList = (list: CategoryOption[]) => {
      setMessageCategories(list);
      setMessageCategory((current) =>
        list.some((item) => item.id === current) ? current : list[0]?.id ?? 'quotations'
      );
    };

    const cached = peekCategoriesForProject(messageProjectId);
    if (cached) {
      applyList(cached);
      return;
    }

    let cancelled = false;
    setLoadingMessageCategories(true);
    void fetchCategoriesForProject(messageProjectId)
      .then((list) => {
        if (cancelled) return;
        applyList(list);
      })
      .catch(() => {
        if (!cancelled) setMessageCategories(DEFAULT_CATEGORIES);
      })
      .finally(() => {
        if (!cancelled) setLoadingMessageCategories(false);
      });

    return () => {
      cancelled = true;
    };
  }, [messageProjectId]);

  useEffect(() => {
    manualComposePickRef.current = { project: false, category: false };
    lastAppliedSuggestTitleRef.current = '';
  }, [debouncedTitle]);

  const handleMessageProjectIdChange = useCallback((id: string) => {
    manualComposePickRef.current = { ...manualComposePickRef.current, project: true };
    setMessageProjectId(id);
  }, []);

  const handleMessageCategoryChange = useCallback((value: TaskCategory) => {
    manualComposePickRef.current = { ...manualComposePickRef.current, category: true };
    setMessageCategory(value);
  }, []);

  const applySuggestResult = useCallback(
    (trimmed: string, result: Awaited<ReturnType<typeof suggestMessageProjectFromTitle>>) => {
      const manual = manualComposePickRef.current;
      if (!manual.project && result.projectId) {
        setMessageProjectId(result.projectId);
      }
      if (!manual.category && result.category) {
        setMessageCategory(result.category);
      }
      lastAppliedSuggestTitleRef.current = trimmed;
    },
    []
  );

  useEffect(() => {
    if (debouncedTitle.length < 2 || projectsRef.current.length === 0) {
      return;
    }
    if (manualComposePickRef.current.project && manualComposePickRef.current.category) {
      return;
    }
    if (debouncedTitle === lastAppliedSuggestTitleRef.current) {
      return;
    }

    const projectList = projectsRef.current;
    const manual = manualComposePickRef.current;
    const localId = matchProjectFromTitle(debouncedTitle, projectList);
    const localCat = matchCategoryFromTitle(debouncedTitle);

    if (!manual.project && localId) {
      setMessageProjectId(localId);
    }
    if (!manual.category && localCat) {
      setMessageCategory(localCat);
    }

    if (!titleNeedsAiProjectSuggest(debouncedTitle, projectList)) {
      lastAppliedSuggestTitleRef.current = debouncedTitle;
      return;
    }

    const requestId = ++suggestRequestIdRef.current;
    setSuggestingAi(true);

    void suggestMessageProjectFromTitle(debouncedTitle, projectList)
      .then((result) => {
        if (requestId !== suggestRequestIdRef.current) return;
        applySuggestResult(debouncedTitle, result);
      })
      .finally(() => {
        if (requestId === suggestRequestIdRef.current) {
          setSuggestingAi(false);
        }
      });
  }, [debouncedTitle, applySuggestResult]);

  useEffect(() => {
    setActionDrafts((prev) =>
      prev.map((draft) => ({
        ...draft,
        projectId: messageProjectId || draft.projectId,
        category: draft.categoryOverride ?? messageCategory,
      }))
    );
  }, [messageProjectId, messageCategory]);

  const handleSuggestFromText = async () => {
    const trimmed = messageBodyToPlainText(body);
    if (!trimmed) return;

    setParsingAi(true);
    setError('');
    try {
      const parsed = await parseActionPointsFromText(trimmed);

      if (parsed.projects.length > 0) {
        onProjectsReplace(parsed.projects as Project[]);
      } else {
        await reloadTaskboardContext();
      }

      if (parsed.assignees.length > 0) {
        onAssigneeOptionsReplace(buildAssigneeOptionsFromNames(parsed.assignees));
      } else {
        await reloadTaskboardContext();
      }

      if (parsed.tasks.length === 0) {
        setError(t('messages.aiNoTasks'));
        return;
      }

      setActionDrafts(
        parsed.tasks.map((row) => ({
          ...row,
          projectId: messageProjectId || row.projectId,
          category: messageCategory,
          draftId: crypto.randomUUID(),
          enabled: true,
        }))
      );
      setActionDraftsFromAi(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('messages.aiParseError'));
    } finally {
      setParsingAi(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedTitle = getTitle();
    const normalizedBody = normalizeOutgoingMessageBody(body);
    const bodyToSend = appendMessageAttachmentsHtml(
      normalizedBody,
      attachments.map((file) => ({
        storagePath: file.storagePath,
        fileName: file.fileName,
      }))
    );
    if (!username) return;
    if (!trimmedTitle) {
      setError(t('messages.messageTitleRequired'));
      return;
    }
    if (!htmlMessageHasContent(bodyToSend)) return;
    if (!messageProjectId) {
      setError(t('messages.messageProjectRequired'));
      return;
    }
    if (!messageCategory) {
      setError(t('messages.messageCategoryRequired'));
      return;
    }

    const enabledDrafts = actionDrafts.filter((d) => d.enabled);

    for (const draft of enabledDrafts) {
      if (!draft.taskName.trim()) {
        setError(t('messages.actionTitleRequired'));
        return;
      }
      if (!messageProjectId) {
        setError(t('messages.messageProjectRequired'));
        return;
      }
      if (draft.assignees.length === 0) {
        setError(t('messages.assigneeRequired'));
        return;
      }
    }

    setSubmitting(true);
    setError('');
    try {
      const created = await createTeamMessage({
        title: trimmedTitle,
        body: bodyToSend,
        projectId: messageProjectId,
        category: messageCategory,
        author: { username, displayName },
        actionPoints:
          enabledDrafts.length > 0
            ? enabledDrafts.map(({ draftId: _id, enabled: _en, categoryOverride, ...ap }) => ({
                taskName: ap.taskName,
                projectId: messageProjectId,
                category: categoryOverride ?? messageCategory,
                assignees: ap.assignees,
              }))
            : undefined,
      });
      clearTitle();
      setBody('');
      setActionDrafts([]);
      setAttachments([]);
      setExcludedNotifyUsernames([]);
      setActionDraftsFromAi(false);
      setMessageProjectId('');
      lastAppliedSuggestTitleRef.current = '';
      closeCompose();
      clearMessageComposeDraft(username);
      if (!isLocalTaskboardMode()) {
        try {
          await notifyTeamMessagePosted({
            messageId: created.id,
            excludedUsernames: excludedNotifyUsernames,
          });
        } catch (notifyErr) {
          console.warn('Message posted but email notify failed:', notifyErr);
        }
      }
      await onPosted(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('messages.postError'));
    } finally {
      setSubmitting(false);
    }
  };

  const canPost =
    hasContent &&
    (htmlMessageHasContent(body) || attachments.length > 0) &&
    Boolean(messageProjectId) &&
    Boolean(messageCategory);

  const composeFields = (
    <>
      <label className="block">
        <span className="tb-field-label mb-2 block">{t('messages.messageTitle')}</span>
        <input
          ref={titleInputRef}
          type="text"
          defaultValue=""
          className="field-input w-full"
          placeholder={t('messages.messageTitlePlaceholder')}
          disabled={submitting}
          autoComplete="off"
        />
      </label>

      <p className="text-xs tb-muted -mt-2">{t('messages.suggestComposeHint')}</p>

      <label className="block">
        <span className="tb-field-label mb-2 block">{t('task.description')}</span>
        <MessageRichTextEditor
          username={username}
          value={body}
          onChange={setBody}
          placeholder={t('messages.composePlaceholder')}
          disabled={submitting}
          maxHeightClassName="max-h-[min(16rem,32vh)] md:max-h-[min(14rem,28vh)]"
          aria-label={t('task.description')}
        />
      </label>

      <MessageComposeAttachments
        username={username}
        attachments={attachments}
        onChange={setAttachments}
        disabled={submitting}
      />

      <MessageComposeNotificationRecipients
        excludedUsernames={excludedNotifyUsernames}
        onExcludedUsernamesChange={setExcludedNotifyUsernames}
        disabled={submitting}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="tb-btn-secondary text-sm"
          disabled={submitting || parsingAi || !htmlMessageHasContent(body)}
          onClick={() => void handleSuggestFromText()}
        >
          {parsingAi ? t('messages.aiParsing') : t('messages.aiSuggest')}
        </button>
      </div>

      {actionDrafts.length > 0 ? (
        <ActionPointsDraftEditor
          drafts={actionDrafts}
          onChange={(next) => {
            setActionDrafts(next);
            if (next.length === 0) {
              setActionDraftsFromAi(false);
            }
          }}
          projects={projects}
          messageProjectId={messageProjectId}
          messageCategory={messageCategory}
          messageCategories={messageCategories}
          isAdmin={isAdmin}
          assigneeOptions={assigneeOptions}
          disabled={submitting}
          fromAiSuggest={actionDraftsFromAi}
        />
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </>
  );

  const composeFooter = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        className={`tb-btn-primary ${
          actionDrafts.length > 0
            ? 'ring-2 ring-[var(--tb-accent)] ring-offset-2 ring-offset-[var(--tb-bg)]'
            : ''
        }`}
        disabled={submitting}
        onClick={appendActionDraft}
      >
        {t('messages.addActionPoint')}
      </button>
      <button type="submit" className="tb-btn-primary shrink-0" disabled={submitting || !canPost}>
        {submitting ? t('messages.posting') : t('messages.post')}
      </button>
    </div>
  );

  return (
    <>
      {!expanded ? (
        <div className="shrink-0 tb-messages-compose-collapsed overflow-hidden" aria-expanded={false}>
          <button
            type="button"
            onClick={openCompose}
            className="tb-messages-compose-collapsed__btn"
            aria-label={t('messages.composeExpand')}
          >
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <PenLine className="tb-messages-compose-collapsed__icon w-5 h-5" aria-hidden />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="tb-messages-compose-collapsed__title">
                  {t('messages.composeCollapsedLabel')}
                </span>
                {hasDraft ? (
                  <span className="text-xs tb-muted truncate">{t('messages.composeDraft')}</span>
                ) : null}
              </span>
            </span>
            <ChevronUp className="tb-messages-compose-collapsed__chevron w-5 h-5" aria-hidden />
          </button>
        </div>
      ) : null}

      {expanded
        ? createPortal(
            <div
              className="taskboard tb-drawer-shell tb-messages-compose-drawer fixed inset-x-0 bottom-0 z-[80] md:inset-auto md:z-40"
              data-theme={theme}
            >
              <aside
                className="tb-drawer tb-drawer-panel tb-messages-compose-drawer__panel pointer-events-auto flex flex-col min-h-0"
                role="dialog"
                aria-modal="true"
                aria-label={t('messages.composeLabel')}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="tb-drawer-edge" aria-hidden="true" />
                <div className="relative z-20 shrink-0 tb-drawer-header px-4 md:px-6 py-3 flex flex-col gap-2 overflow-visible">
                  <div className="flex items-start justify-between gap-3">
                    <p className="tb-field-label text-sm leading-none pt-1">{t('messages.composeLabel')}</p>
                    <button
                      type="button"
                      onClick={closeCompose}
                      className="text-[#80868b] hover:text-[#202124] transition-colors shrink-0"
                      aria-label={t('messages.composeMinimize')}
                    >
                      <X size={20} />
                    </button>
                  </div>
                  {projects.length > 0 ? (
                    <>
                      <p className="text-xs tb-muted leading-snug">{t('messages.suggestProjectHint')}</p>
                      <MessageComposeSuggestChips
                        projects={projects}
                        projectId={messageProjectId}
                        category={messageCategory}
                        categories={messageCategories}
                        loadingProjects={loadingProjects}
                        loadingCategories={loadingMessageCategories}
                        suggesting={suggestingAi}
                        disabled={submitting}
                        onProjectIdChange={handleMessageProjectIdChange}
                        onCategoryChange={handleMessageCategoryChange}
                        visible
                      />
                    </>
                  ) : null}
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="flex flex-col flex-1 min-h-0"
                  aria-expanded
                >
                  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 md:px-6 py-4 space-y-3">
                    {composeFields}
                  </div>
                  <div className="shrink-0 border-t border-[var(--tb-border)] bg-[var(--tb-bg)] px-4 md:px-6 py-3">
                    {composeFooter}
                  </div>
                </form>
              </aside>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export default memo(MessageComposeForm);
