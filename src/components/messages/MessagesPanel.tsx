import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMessagesCompose } from '../../context/MessagesComposeContext';
import { isFeedAutoScrollSuppressed } from '../../lib/messages/messageFeedScrollAnchor';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { defaultBoardNameForUsername } from '../../lib/taskboard/boardNameUtils';
import { fetchAssigneeNames, fetchMembers } from '../../lib/taskboard/memberService';
import {
  fetchTeamMessagesOlderThan,
  fetchTeamMessagesRecent,
  fetchTeamMessagesWindow,
  isTeamMessagesReady,
  mergeTeamMessagesById,
  subscribeToTeamMessages,
  TEAM_MESSAGES_PAGE_SIZE,
} from '../../lib/messages/teamMessageService';
import type { TeamMessage } from '../../lib/messages/types';
import { withRetry } from '../../lib/taskboard/loadUtils';
import { ensureSupabaseSession } from '../../lib/supabase';
import { isSupabaseConfigured } from '../../lib/taskboard/config';
import { fetchProjects, fetchVisibleProjects } from '../../lib/taskboard/taskService';
import type { Project } from '../../lib/taskboard/types';
import {
  buildAssigneeOptionsFromMembers,
  buildAssigneeOptionsFromNames,
  type TaskboardAssigneeOption,
} from './MessageActionPointFields';
import MessageComposeForm from './MessageComposeForm';
import MessageRow from './MessageRow';

export default function MessagesPanel() {
  const { username, isAdmin, sessionReady } = useTaskboardAuth();
  const { profile } = useUserProfile();
  const { t, locale } = useTaskboardI18n();
  const { drawerOpen: composeDrawerOpen, setComposeWillOpenHandler } = useMessagesCompose();
  const prevComposeDrawerOpenRef = useRef<boolean | null>(null);

  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(true);
  const [error, setError] = useState('');
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const [projectFilter, setProjectFilter] = useState<'all' | string>('all');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [assigneeOptions, setAssigneeOptions] = useState<TaskboardAssigneeOption[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [teamReady, setTeamReady] = useState(true);

  const feedScrollRef = useRef<HTMLElement>(null);
  const messagesRef = useRef<TeamMessage[]>([]);
  const stickToBottomRef = useRef(true);
  /** After refresh / filter change, stay pinned until the user scrolls away from the bottom. */
  const pinFeedToBottomRef = useRef(true);
  const loadingOlderScrollRef = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const prevFilteredCountRef = useRef(0);
  /** Ignore scroll events while the feed resizes (compose drawer open/close). */
  const ignoreFeedScrollPinResetRef = useRef(false);
  /** Keep feed scrollTop stable while the compose drawer changes layout. */
  const preserveFeedScrollRef = useRef(false);
  /** Distance from bottom — stable when the feed container height changes (compose drawer). */
  const savedFeedDistanceFromBottomRef = useRef(0);

  const captureFeedScroll = useCallback(() => {
    const el = feedScrollRef.current;
    if (!el) return;
    savedFeedDistanceFromBottomRef.current = Math.max(
      0,
      el.scrollHeight - el.scrollTop - el.clientHeight
    );
    preserveFeedScrollRef.current = true;
  }, []);

  const restoreFeedScroll = useCallback(() => {
    const el = feedScrollRef.current;
    if (!el) return;
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    const nextTop = maxScrollTop - savedFeedDistanceFromBottomRef.current;
    el.scrollTop = Math.max(0, Math.min(nextTop, maxScrollTop));
  }, []);

  const restoreFeedScrollAfterLayout = useCallback(() => {
    restoreFeedScroll();
    requestAnimationFrame(() => {
      restoreFeedScroll();
      requestAnimationFrame(restoreFeedScroll);
    });
  }, [restoreFeedScroll]);

  const scrollFeedToBottom = useCallback(() => {
    const el = feedScrollRef.current;
    if (!el) return;
    el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
  }, []);

  const stickFeedToBottomAfterLayout = useCallback(() => {
    scrollFeedToBottom();
    requestAnimationFrame(() => {
      scrollFeedToBottom();
      requestAnimationFrame(scrollFeedToBottom);
    });
  }, [scrollFeedToBottom]);

  messagesRef.current = messages;

  const displayName = useMemo(() => {
    if (profile?.board_name?.trim()) return profile.board_name.trim();
    if (username) return defaultBoardNameForUsername(username);
    return '';
  }, [profile?.board_name, username]);

  const loadInitial = useCallback(async () => {
    const { messages: rows, hasMoreOlder: more } = await fetchTeamMessagesRecent();
    setMessages(rows);
    setHasMoreOlder(more);
    setError('');
    stickToBottomRef.current = true;
    pinFeedToBottomRef.current = true;
  }, []);

  const reload = useCallback(async () => {
    try {
      const count = Math.max(TEAM_MESSAGES_PAGE_SIZE, messagesRef.current.length + 1);
      const { messages: rows, hasMoreOlder: more } = await fetchTeamMessagesWindow(count);
      setMessages((prev) => mergeTeamMessagesById(prev, rows));
      setHasMoreOlder(more);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('messages.loadError'));
    }
  }, [t]);

  const loadOlder = useCallback(async () => {
    const oldest = messagesRef.current[0];
    if (!oldest || loadingOlder) return;

    const el = feedScrollRef.current;
    if (el) {
      prevScrollHeightRef.current = el.scrollHeight;
      loadingOlderScrollRef.current = true;
    }
    stickToBottomRef.current = false;
    pinFeedToBottomRef.current = false;
    setLoadingOlder(true);
    setError('');

    try {
      const { messages: older, hasMoreOlder: more } = await fetchTeamMessagesOlderThan(oldest);
      if (older.length === 0) {
        setHasMoreOlder(false);
        return;
      }
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const merged = [...older.filter((m) => !seen.has(m.id)), ...prev];
        return merged;
      });
      setHasMoreOlder(more);
    } catch (err) {
      loadingOlderScrollRef.current = false;
      setError(err instanceof Error ? err.message : t('messages.loadError'));
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, t]);

  const onMessageMutated = useCallback(() => {
    void reload();
  }, [reload]);

  const onMessageDeleted = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

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
        return loadInitial();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadInitial]);

  const reloadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleReload = useCallback(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    if (reloadDebounceRef.current) clearTimeout(reloadDebounceRef.current);
    reloadDebounceRef.current = setTimeout(() => {
      reloadDebounceRef.current = null;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      void reload();
    }, 1200);
  }, [reload]);

  useEffect(() => {
    if (!ready) return;
    const unsub = subscribeToTeamMessages(scheduleReload);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void reload();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsub();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ready, scheduleReload, reload]);

  const loadTaskboardContext = useCallback(async () => {
    if (!username) {
      return { projects: [] as Project[], assigneeOptions: [] as TaskboardAssigneeOption[] };
    }
    setLoadingProjects(true);
    setLoadingTeam(true);

    let list: Project[] = [];
    let options: TaskboardAssigneeOption[] = [];

    try {
      if (isSupabaseConfigured()) {
        await ensureSupabaseSession();
      }
      list = await withRetry(() =>
        isAdmin ? fetchProjects() : fetchVisibleProjects(username, isAdmin)
      );
    } catch (err) {
      setProjects([]);
      list = [];
      console.error('Messages: could not load projects', err);
    } finally {
      setLoadingProjects(false);
    }

    if (list.length > 0) {
      setProjects(list);
    }

    try {
      if (isAdmin) {
        const membersResult = await fetchMembers();
        setTeamReady(membersResult.membersReady);
        options = buildAssigneeOptionsFromMembers(membersResult.members);
      } else {
        setTeamReady(true);
        const names = await fetchAssigneeNames();
        options = buildAssigneeOptionsFromNames(names);
      }
      if (options.length === 0) {
        const names = await fetchAssigneeNames();
        options = buildAssigneeOptionsFromNames(names);
      }
      setAssigneeOptions(options);
    } catch {
      try {
        const names = await fetchAssigneeNames();
        options = buildAssigneeOptionsFromNames(names);
        setAssigneeOptions(options);
        setTeamReady(true);
      } catch {
        setAssigneeOptions([]);
        options = [];
      }
    } finally {
      setLoadingTeam(false);
    }

    return { projects: list, assigneeOptions: options };
  }, [username, isAdmin]);

  useEffect(() => {
    if (!ready || !username || !sessionReady) return;
    void loadTaskboardContext();
  }, [ready, username, sessionReady, loadTaskboardContext]);

  const filteredMessages = useMemo(() => {
    if (projectFilter === 'all') return messages;
    return messages.filter((message) => message.project_id === projectFilter);
  }, [messages, projectFilter]);

  useEffect(() => {
    stickToBottomRef.current = true;
    pinFeedToBottomRef.current = true;
  }, [projectFilter]);

  useEffect(() => {
    const onComposeWillOpen = () => {
      ignoreFeedScrollPinResetRef.current = true;
      captureFeedScroll();
    };
    setComposeWillOpenHandler(onComposeWillOpen);
    return () => setComposeWillOpenHandler(null);
  }, [captureFeedScroll, setComposeWillOpenHandler]);

  const onFeedScroll = useCallback(() => {
    if (ignoreFeedScrollPinResetRef.current) return;
    const el = feedScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 48;
    stickToBottomRef.current = nearBottom;
    if (!nearBottom) {
      pinFeedToBottomRef.current = false;
    }
  }, []);

  useLayoutEffect(() => {
    if (messagesRef.current.length === 0) return;

    if (prevComposeDrawerOpenRef.current === null) {
      prevComposeDrawerOpenRef.current = composeDrawerOpen;
      return;
    }
    if (prevComposeDrawerOpenRef.current === composeDrawerOpen) {
      return;
    }
    prevComposeDrawerOpenRef.current = composeDrawerOpen;

    ignoreFeedScrollPinResetRef.current = true;
    restoreFeedScrollAfterLayout();

    const timers = [0, 50, 150, 280, 400, 550, 700].map((ms) =>
      window.setTimeout(() => restoreFeedScroll(), ms)
    );

    const endTimer = window.setTimeout(() => {
      preserveFeedScrollRef.current = false;
      ignoreFeedScrollPinResetRef.current = false;
    }, 750);

    return () => {
      for (const id of timers) window.clearTimeout(id);
      window.clearTimeout(endTimer);
      preserveFeedScrollRef.current = false;
      ignoreFeedScrollPinResetRef.current = false;
    };
  }, [composeDrawerOpen, restoreFeedScroll, restoreFeedScrollAfterLayout]);

  useLayoutEffect(() => {
    const el = feedScrollRef.current;
    if (!el || filteredMessages.length === 0) return;

    if (loadingOlderScrollRef.current) {
      const delta = el.scrollHeight - prevScrollHeightRef.current;
      el.scrollTop += delta;
      loadingOlderScrollRef.current = false;
      prevFilteredCountRef.current = filteredMessages.length;
      return;
    }

    if (preserveFeedScrollRef.current) {
      restoreFeedScroll();
    } else if (
      !isFeedAutoScrollSuppressed() &&
      (pinFeedToBottomRef.current || stickToBottomRef.current)
    ) {
      stickFeedToBottomAfterLayout();
    }
    prevFilteredCountRef.current = filteredMessages.length;
  }, [
    filteredMessages.length,
    messages.length,
    loading,
    stickFeedToBottomAfterLayout,
    restoreFeedScroll,
  ]);

  useEffect(() => {
    const el = feedScrollRef.current;
    if (!el || filteredMessages.length === 0) return;

    const onResize = () => {
      if (loadingOlderScrollRef.current) return;
      if (preserveFeedScrollRef.current) {
        restoreFeedScroll();
        return;
      }
      if (
        !isFeedAutoScrollSuppressed() &&
        (pinFeedToBottomRef.current || stickToBottomRef.current)
      ) {
        scrollFeedToBottom();
      }
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(el);
    const list = el.querySelector('ul');
    if (list) observer.observe(list);
    const end = el.querySelector('[data-messages-feed-end]');
    if (end instanceof HTMLElement) observer.observe(end);

    return () => observer.disconnect();
  }, [filteredMessages.length, scrollFeedToBottom, composeDrawerOpen, restoreFeedScroll]);

  const messageCountsByProject = useMemo(() => {
    const counts = new Map<string, number>();
    for (const message of messages) {
      if (!message.project_id) continue;
      counts.set(message.project_id, (counts.get(message.project_id) ?? 0) + 1);
    }
    return counts;
  }, [messages]);

  const projectsByMessageCount = useMemo(() => {
    return [...projects].sort((a, b) => {
      const countA = messageCountsByProject.get(a.id) ?? 0;
      const countB = messageCountsByProject.get(b.id) ?? 0;
      if (countB !== countA) return countB - countA;
      return a.name.localeCompare(b.name);
    });
  }, [projects, messageCountsByProject]);

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

  const composeForm = username ? (
    <MessageComposeForm
      username={username}
      displayName={displayName}
      isAdmin={isAdmin}
      projects={projects}
      loadingProjects={loadingProjects}
      assigneeOptions={assigneeOptions}
      loadingTeam={loadingTeam}
      teamReady={teamReady}
      onPosted={async (created) => {
            stickToBottomRef.current = true;
            pinFeedToBottomRef.current = true;
            setProjectFilter((prev) =>
          prev === 'all' || prev === created.project_id ? prev : 'all'
        );
        setMessages((prev) => mergeTeamMessagesById(prev, [created]));
        await reload();
      }}
      onProjectsReplace={setProjects}
      onAssigneeOptionsReplace={setAssigneeOptions}
      reloadTaskboardContext={loadTaskboardContext}
    />
  ) : null;

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full gap-3">
      {projects.length > 0 ? (
        <div
          className="tb-header-scroll-row tb-header-scroll-row--filters shrink-0"
          role="group"
          aria-label={t('messages.filterByProject')}
        >
          <button
            type="button"
            onClick={() => setProjectFilter('all')}
            className={`tb-filter-btn relative ${projectFilter === 'all' ? 'tb-filter-btn--active' : ''}`}
          >
            {t('filter.all')}
            {messages.length > 0 && (
              <span className="tb-filter-count">{messages.length}</span>
            )}
          </button>
          {projectsByMessageCount.map((project) => {
            const count = messageCountsByProject.get(project.id) ?? 0;
            const active = projectFilter === project.id;
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => setProjectFilter(project.id)}
                className={`tb-filter-btn relative ${active ? 'tb-filter-btn--active' : ''}`}
                title={project.name}
              >
                <span className="max-w-[12rem] truncate">{project.name}</span>
                {count > 0 && <span className="tb-filter-count">{count}</span>}
              </button>
            );
          })}
        </div>
      ) : null}

      <section
        ref={feedScrollRef}
        onScroll={onFeedScroll}
        className="tb-remote-inst-card tb-messages-feed p-4 md:p-6 flex-1 min-h-0 overflow-y-auto"
      >
        {loading && messages.length === 0 ? (
          <p className="text-sm tb-muted">{t('messages.loading')}</p>
        ) : null}
        {!loading && messages.length === 0 ? (
          <p className="text-sm tb-muted">{t('messages.empty')}</p>
        ) : null}
        {!loading && messages.length > 0 && filteredMessages.length === 0 ? (
          <p className="text-sm tb-muted">{t('messages.noMessagesForProject')}</p>
        ) : null}
        {error ? <p className="text-sm text-red-600 mb-4">{error}</p> : null}
        {hasMoreOlder ? (
          <div className="mb-4 flex justify-center">
            <button
              type="button"
              className="tb-btn-secondary text-sm disabled:opacity-50"
              disabled={loadingOlder}
              onClick={() => void loadOlder()}
            >
              {loadingOlder ? t('messages.loadingOlder') : t('messages.loadOlder')}
            </button>
          </div>
        ) : null}
        <ul className="space-y-4">
          {filteredMessages.map((message) => (
            <MessageRow
              key={message.id}
              message={message}
              locale={locale}
              currentUsername={username}
              projects={projects}
              isAdmin={isAdmin}
              onMutated={onMessageMutated}
              onDeleted={onMessageDeleted}
            />
          ))}
        </ul>
        <div data-messages-feed-end className="h-px w-full shrink-0" aria-hidden />
      </section>

      {composeForm ? (
        <div
          className={
            composeDrawerOpen
              ? 'h-0 min-h-0 shrink-0 overflow-hidden p-0 m-0'
              : 'shrink-0 min-h-0 pb-2'
          }
          aria-hidden={composeDrawerOpen}
        >
          {composeForm}
        </div>
      ) : null}
    </div>
  );
}
