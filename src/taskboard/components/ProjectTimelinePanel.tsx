import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTaskboardFilter } from '../../context/TaskboardFilterContext';
import { useTaskboardRefresh } from '../../context/TaskboardRefreshContext';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { formatMessage, type MessageKey } from '../../lib/taskboard/i18n/messages';
import { calendarProjectTimelineUrl } from '../../lib/taskboard/calendarProjectUrl';
import {
  fetchProjectTimeline,
  fetchProjectTimelinesBatch,
  saveProjectTimeline,
  type ProjectTimelineBlockInput,
  type ProjectTimelineState,
} from '../../lib/taskboard/projectTimelineService';
import {
  buildTimelineWeekSlots,
  formatTimelineWeekStartDate,
  isoWeekNumber,
  normalizeTimelineBlocksForSave,
  PROJECT_TIMELINE_WEEKS_AHEAD,
  PROJECT_TIMELINE_WEEKS_BEHIND,
  sortTimelineBlocks,
  timelineBlockHasContent,
  timelineSlotsInBlockRange,
  validateTimelineBlocks,
} from '../../lib/taskboard/projectTimelineUtils';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import MessageRichTextEditor from '../../components/messages/MessageRichTextEditor';
import ProjectTimelineGrid from './ProjectTimelineGrid';
import ProjectTimelineBlockDetailDialog, {
  type TimelineBlockDetail,
} from './ProjectTimelineBlockDetailDialog';

function newEmptyBlock(firstWeekKey: string): ProjectTimelineBlockInput {
  return {
    week_start: firstWeekKey,
    week_end: firstWeekKey,
    name: '',
    description: '',
  };
}

function entriesToBlocks(
  entries: { week_start: string; week_end: string; name: string; description: string }[]
): ProjectTimelineBlockInput[] {
  return sortTimelineBlocks(
    entries.map((e) => ({
      week_start: e.week_start,
      week_end: e.week_end,
      name: e.name,
      description: e.description,
    }))
  );
}

export default function ProjectTimelinePanel() {
  const { t } = useTaskboardI18n();
  const { username } = useTaskboardAuth();
  const { projectFilter, filterProjects } = useTaskboardFilter();
  const { refreshProjects } = useTaskboardRefresh();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [shareNotice, setShareNotice] = useState('');
  const [timelineCompleted, setTimelineCompleted] = useState(false);
  const [draftCompleted, setDraftCompleted] = useState(false);
  const [draftBlocks, setDraftBlocks] = useState<ProjectTimelineBlockInput[]>([]);
  const [timelinesByProject, setTimelinesByProject] = useState<Map<string, ProjectTimelineState>>(
    () => new Map()
  );
  const [blockDetail, setBlockDetail] = useState<TimelineBlockDetail | null>(null);

  const weekSlots = useMemo(
    () => buildTimelineWeekSlots(PROJECT_TIMELINE_WEEKS_AHEAD, new Date(), PROJECT_TIMELINE_WEEKS_BEHIND),
    []
  );
  const weekKeys = useMemo(() => weekSlots.map((s) => s.weekStartKey), [weekSlots]);

  const selectedProject = useMemo(
    () => filterProjects.find((project) => project.id === projectFilter) ?? null,
    [filterProjects, projectFilter]
  );

  const timetableHasBlocks = useMemo(() => {
    for (const project of filterProjects) {
      const entries = timelinesByProject.get(project.id)?.entries ?? [];
      if (entries.some((entry) => timelineBlockHasContent(entry))) return true;
    }
    return false;
  }, [filterProjects, timelinesByProject]);

  const loadAllTimelines = useCallback(async () => {
    if (filterProjects.length === 0) {
      setTimelinesByProject(new Map());
      return;
    }
    setLoading(true);
    setError('');
    try {
      const batch = await fetchProjectTimelinesBatch(filterProjects.map((p) => p.id));
      setTimelinesByProject(batch);
    } catch {
      setError(t('calendar.projectTimelineLoadError'));
      setTimelinesByProject(new Map());
    } finally {
      setLoading(false);
    }
  }, [filterProjects, t]);

  const loadSelectedTimeline = useCallback(async () => {
    if (projectFilter === 'all' || !selectedProject) {
      setTimelineCompleted(false);
      setDraftBlocks([]);
      return;
    }

    try {
      const state = await fetchProjectTimeline(projectFilter);
      setTimelineCompleted(state.timelineCompleted);
      setDraftCompleted(state.timelineCompleted);
      setDraftBlocks(entriesToBlocks(state.entries));
      setTimelinesByProject((prev) => {
        const next = new Map(prev);
        next.set(projectFilter, state);
        return next;
      });
    } catch {
      setError(t('calendar.projectTimelineLoadError'));
      setDraftBlocks([]);
    }
  }, [projectFilter, selectedProject, t]);

  useEffect(() => {
    void loadAllTimelines();
  }, [loadAllTimelines]);

  useEffect(() => {
    if (editing) void loadSelectedTimeline();
  }, [editing, loadSelectedTimeline]);

  useEffect(() => {
    setEditing(false);
    setShareNotice('');
  }, [projectFilter]);

  const startEdit = () => {
    if (projectFilter === 'all') return;
    setDraftCompleted(timelineCompleted);
    setEditing(true);
    setError('');
    void loadSelectedTimeline().then(() => {
      setDraftBlocks((prev) => {
        if (prev.length > 0 || !weekKeys[0]) return prev;
        return [newEmptyBlock(weekKeys[0])];
      });
    });
  };

  const cancelEdit = () => {
    setEditing(false);
    void loadSelectedTimeline();
    void loadAllTimelines();
  };

  const saveTimeline = async () => {
    if (projectFilter === 'all') return;

    const normalized = normalizeTimelineBlocksForSave(draftBlocks, weekKeys);
    const validationKey = validateTimelineBlocks(normalized, weekKeys);
    if (validationKey) {
      setError(t(validationKey as MessageKey));
      return;
    }

    setSaving(true);
    setError('');
    try {
      const state = await saveProjectTimeline(projectFilter, normalized, draftCompleted);
      setTimelineCompleted(state.timelineCompleted);
      setDraftCompleted(state.timelineCompleted);
      setDraftBlocks(entriesToBlocks(state.entries));
      setTimelinesByProject((prev) => {
        const next = new Map(prev);
        next.set(projectFilter, state);
        return next;
      });
      setEditing(false);
      refreshProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('calendar.projectTimelineSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const copyShareUrl = async () => {
    if (!selectedProject) return;
    const url = calendarProjectTimelineUrl(selectedProject.slug);
    setShareNotice('');
    try {
      await navigator.clipboard.writeText(url);
      setShareNotice(t('calendar.projectTimelineShareCopied'));
    } catch {
      setShareNotice(url);
    }
  };

  const updateBlock = (index: number, patch: Partial<ProjectTimelineBlockInput>) => {
    setDraftBlocks((prev) =>
      prev.map((block, i) => (i === index ? { ...block, ...patch } : block))
    );
  };

  const removeBlock = (index: number) => {
    setDraftBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  const addBlock = () => {
    const key = weekKeys[0] ?? '';
    setDraftBlocks((prev) => [...prev, newEmptyBlock(key)]);
  };

  const renderWeekLines = (block: ProjectTimelineBlockInput) => {
    const slots = timelineSlotsInBlockRange(block.week_start, block.week_end, weekSlots);
    return (
      <ul className="space-y-1.5 list-none p-0 m-0">
        {slots.map((slot) => (
          <li key={slot.weekStartKey} className="text-xs tb-muted leading-snug">
            {formatMessage(t('calendar.projectTimelineWeekLine'), {
              number: String(isoWeekNumber(slot.weekStart)),
              date: formatTimelineWeekStartDate(slot.weekStart),
            })}
          </li>
        ))}
      </ul>
    );
  };

  const renderWeekCell = (block: ProjectTimelineBlockInput, index: number) => (
    <div className="flex flex-col gap-3 min-w-[10rem]">
      <div className="flex flex-col gap-2">
        <label className="text-[10px] uppercase tracking-wide tb-muted">
          {t('calendar.projectTimelineWeekFrom')}
        </label>
        <select
          className="field-input text-sm"
          value={block.week_start}
          disabled={saving}
          onChange={(e) => updateBlock(index, { week_start: e.target.value })}
        >
          {weekSlots.map((slot) => (
            <option key={slot.weekStartKey} value={slot.weekStartKey}>
              {slot.label}
            </option>
          ))}
        </select>
        <label className="text-[10px] uppercase tracking-wide tb-muted">
          {t('calendar.projectTimelineWeekTo')}
        </label>
        <select
          className="field-input text-sm"
          value={block.week_end}
          disabled={saving}
          onChange={(e) => updateBlock(index, { week_end: e.target.value })}
        >
          {weekSlots.map((slot) => (
            <option key={slot.weekStartKey} value={slot.weekStartKey}>
              {slot.label}
            </option>
          ))}
        </select>
      </div>
      {renderWeekLines(block)}
    </div>
  );

  return (
    <section className="tb-remote-inst-card p-6 md:p-8 mb-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <h2 className="tb-heading text-lg">{t('calendar.projectTimelineHeading')}</h2>
          {editing && selectedProject ? (
            <p className="text-sm tb-muted mt-1">
              {formatMessage(t('calendar.projectTimelineEditingProject'), {
                name: selectedProject.name,
              })}
            </p>
          ) : null}
        </div>
        {!loading && !editing ? (
          <div className="flex items-center gap-2 shrink-0">
            {selectedProject ? (
              <>
                <button
                  type="button"
                  className="tb-btn-secondary p-2"
                  onClick={() => void copyShareUrl()}
                  aria-label={t('calendar.projectTimelineShare')}
                  title={t('calendar.projectTimelineShare')}
                >
                  <Link2 size={18} aria-hidden />
                </button>
                <button
                  type="button"
                  className="tb-btn-secondary p-2"
                  onClick={startEdit}
                  disabled={projectFilter === 'all'}
                  aria-label={t('calendar.projectTimelineEdit')}
                  title={
                    projectFilter === 'all'
                      ? t('calendar.projectTimelinePickProject')
                      : t('calendar.projectTimelineEdit')
                  }
                >
                  <Pencil size={18} aria-hidden />
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {loading ? <p className="text-sm tb-muted mt-3">{t('common.loading')}</p> : null}

      {error ? <p className="text-sm text-red-600 mt-3">{error}</p> : null}
      {shareNotice ? <p className="text-sm text-[var(--tb-accent)] mt-3">{shareNotice}</p> : null}

      {!loading && !editing ? (
        <ProjectTimelineGrid
          projects={filterProjects}
          timelines={timelinesByProject}
          weekSlots={weekSlots}
          onSelectBlock={setBlockDetail}
        />
      ) : null}

      {!loading && !editing && filterProjects.length > 0 && !timetableHasBlocks ? (
        <p className="text-sm tb-muted mt-3">{t('calendar.projectTimelineNoBlocks')}</p>
      ) : null}

      {editing && projectFilter !== 'all' ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--tb-border)] text-left">
                <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wide tb-muted w-[28%]">
                  {t('calendar.projectTimelineColWeek')}
                </th>
                <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wide tb-muted w-[22%]">
                  {t('calendar.projectTimelineColName')}
                </th>
                <th className="py-2 font-semibold text-xs uppercase tracking-wide tb-muted">
                  {t('calendar.projectTimelineColDescription')}
                </th>
                <th className="w-10" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {draftBlocks.map((block, index) => (
                <tr
                  key={`${block.week_start}-${block.week_end}-${index}`}
                  className="border-b border-[var(--tb-border)] align-top"
                >
                  <td className="py-3 pr-3">{renderWeekCell(block, index)}</td>
                  <td className="py-3 pr-3 min-w-[10rem]">
                    <MessageRichTextEditor
                      key={`name-${index}-${block.week_start}-${block.week_end}`}
                      username={username ?? ''}
                      value={block.name}
                      onChange={(html) => updateBlock(index, { name: html })}
                      disabled={saving}
                      minHeightClassName="min-h-[2.75rem]"
                      maxHeightClassName="max-h-[10rem]"
                      aria-label={t('calendar.projectTimelineColName')}
                    />
                  </td>
                  <td className="py-3 min-w-[14rem]">
                    <MessageRichTextEditor
                      key={`desc-${index}-${block.week_start}-${block.week_end}`}
                      username={username ?? ''}
                      value={block.description}
                      onChange={(html) => updateBlock(index, { description: html })}
                      disabled={saving}
                      minHeightClassName="min-h-[4rem]"
                      maxHeightClassName="max-h-[14rem]"
                      aria-label={t('calendar.projectTimelineColDescription')}
                    />
                  </td>
                  <td className="py-3 pl-2">
                    <button
                      type="button"
                      className="p-2 text-[var(--tb-text-muted)] hover:text-red-600"
                      disabled={saving}
                      aria-label={t('calendar.projectTimelineRemoveBlock')}
                      onClick={() => removeBlock(index)}
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-5 space-y-4 border-t border-[var(--tb-border)] pt-4">
            <button
              type="button"
              className="tb-btn-secondary text-sm inline-flex items-center gap-2"
              disabled={saving}
              onClick={addBlock}
            >
              <Plus size={16} aria-hidden />
              {t('calendar.projectTimelineAddBlock')}
            </button>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-[var(--tb-border)]"
                checked={draftCompleted}
                disabled={saving}
                onChange={(e) => setDraftCompleted(e.target.checked)}
              />
              <span>{t('calendar.projectTimelineMarkCompleted')}</span>
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="tb-btn-secondary text-sm"
                disabled={saving}
                onClick={cancelEdit}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="tb-btn-primary text-sm disabled:opacity-50"
                disabled={saving}
                onClick={() => void saveTimeline()}
              >
                {saving ? t('comments.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ProjectTimelineBlockDetailDialog
        detail={blockDetail}
        weekSlots={weekSlots}
        onClose={() => setBlockDetail(null)}
      />
    </section>
  );
}
