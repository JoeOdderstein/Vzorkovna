import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Link2, Pencil, Plus, Trash2 } from 'lucide-react';
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
  buildTimelineViewportWeekSlots,
  formatTimelineViewportLabel,
  normalizeTimelineBlocksForSave,
  shiftTimelineViewportAnchor,
  suggestedTimelineViewportAnchor,
  timelineViewportShowsBlock,
  PROJECT_TIMELINE_SCROLL_MONTHS_AFTER,
  PROJECT_TIMELINE_SCROLL_MONTHS_BEFORE,
  PROJECT_TIMELINE_WEEKS_AHEAD,
  PROJECT_TIMELINE_WEEKS_BEHIND,
  isTimelinePhase,
  sortTimelineBlocks,
  timelineAllowedDateBounds,
  timelineBlockDateRange,
  timelineBlockHasContent,
  timelineBlockPlainLabel,
  timelineDefaultRangeDateKey,
  validateTimelineBlocks,
} from '../../lib/taskboard/projectTimelineUtils';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import MessageRichTextEditor from '../../components/messages/MessageRichTextEditor';
import ProjectTimelineDateRangePicker from './ProjectTimelineDateRangePicker';
import ProjectTimelineGrid from './ProjectTimelineGrid';
import ProjectTimelineBlockDetailDialog, {
  type TimelineBlockDetail,
} from './ProjectTimelineBlockDetailDialog';

function newEmptyBlock(
  rangeDateKey: string,
  entry_kind: ProjectTimelineBlockInput['entry_kind'] = 'phase',
  parent_client_key: string | null = null,
): ProjectTimelineBlockInput {
  return {
    client_key: crypto.randomUUID(),
    entry_kind,
    parent_entry_id: parent_client_key,
    parent_client_key,
    week_start: rangeDateKey,
    week_end: rangeDateKey,
    name: '',
    description: '',
  };
}

function entriesToBlocks(
  entries: {
    id: string;
    week_start: string;
    week_end: string;
    name: string;
    description: string;
    entry_kind: ProjectTimelineBlockInput['entry_kind'];
    parent_entry_id: string | null;
  }[],
): ProjectTimelineBlockInput[] {
  return sortTimelineBlocks(
    entries.map((e) => ({
      client_key: e.id,
      entry_kind: e.entry_kind ?? 'phase',
      parent_entry_id: e.parent_entry_id,
      parent_client_key: e.parent_entry_id,
      week_start: e.week_start,
      week_end: e.week_end,
      name: e.name,
      description: e.description,
    })),
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
  const [viewportAnchor, setViewportAnchor] = useState(() => new Date());
  const viewportAdjustedRef = useRef(false);

  const weekSlotsEditor = useMemo(
    () => buildTimelineWeekSlots(PROJECT_TIMELINE_WEEKS_AHEAD, new Date(), PROJECT_TIMELINE_WEEKS_BEHIND),
    [],
  );
  const timetableWeekSlots = useMemo(
    () =>
      buildTimelineViewportWeekSlots(
        viewportAnchor,
        PROJECT_TIMELINE_SCROLL_MONTHS_AFTER,
        PROJECT_TIMELINE_SCROLL_MONTHS_BEFORE,
      ),
    [viewportAnchor],
  );
  const timetableRangeLabel = useMemo(
    () => formatTimelineViewportLabel(timetableWeekSlots),
    [timetableWeekSlots],
  );
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
    if (loading || editing || viewportAdjustedRef.current) return;

    const entries = filterProjects.flatMap(
      (project) => timelinesByProject.get(project.id)?.entries ?? [],
    );
    if (entries.length === 0) return;

    const anyVisible = entries.some((entry) => timelineViewportShowsBlock(timetableWeekSlots, entry));
    if (anyVisible) {
      viewportAdjustedRef.current = true;
      return;
    }

    setViewportAnchor(suggestedTimelineViewportAnchor(entries));
    viewportAdjustedRef.current = true;
  }, [loading, editing, filterProjects, timelinesByProject, timetableWeekSlots]);

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
        if (prev.length > 0 || weekSlotsEditor.length === 0) return prev;
        return [newEmptyBlock(timelineDefaultRangeDateKey(weekSlotsEditor))];
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

    const normalized = normalizeTimelineBlocksForSave(draftBlocks, weekSlotsEditor);
    const validationKey = validateTimelineBlocks(normalized, weekSlotsEditor);
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
    const key = timelineDefaultRangeDateKey(weekSlotsEditor);
    setDraftBlocks((prev) => [...prev, newEmptyBlock(key, 'phase')]);
  };

  const addVisit = () => {
    const key = timelineDefaultRangeDateKey(weekSlotsEditor);
    setDraftBlocks((prev) => {
      const phases = prev.filter(isTimelinePhase);
      const parentKey = phases[phases.length - 1]?.client_key ?? null;
      return [...prev, newEmptyBlock(key, 'visit', parentKey)];
    });
  };

  const dateBounds = useMemo(() => timelineAllowedDateBounds(weekSlotsEditor), [weekSlotsEditor]);

  const shiftTimetableViewport = (monthDelta: number) => {
    viewportAdjustedRef.current = true;
    setViewportAnchor((prev) => shiftTimelineViewportAnchor(prev, monthDelta));
  };

  const phaseOptionsForDraft = useMemo(() => {
    return draftBlocks
      .filter(isTimelinePhase)
      .filter((block) => timelineBlockHasContent(block) || block.name || block.description)
      .map((block) => ({
        key: block.client_key,
        label: timelineBlockPlainLabel(block.name) || t('calendar.projectTimelineColName'),
      }));
  }, [draftBlocks, t]);

  const renderDateCell = (block: ProjectTimelineBlockInput, index: number) => {
    const range = timelineBlockDateRange(block);
    if (!dateBounds) {
      return <p className="text-xs tb-muted">{t('calendar.projectTimelineInvalidWeek')}</p>;
    }

    return (
      <ProjectTimelineDateRangePicker
        key={block.client_key}
        startDate={range.start}
        endDate={range.end}
        minDate={dateBounds.min}
        maxDate={dateBounds.max}
        disabled={saving}
        onChange={(week_start, week_end) => updateBlock(index, { week_start, week_end })}
      />
    );
  };

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
        <>
          <div className="mt-3 mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs tb-muted">
              {formatMessage(t('calendar.projectTimelineViewportLabel'), {
                range: timetableRangeLabel,
              })}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                className="tb-btn-secondary p-1.5"
                onClick={() => shiftTimetableViewport(-3)}
                aria-label={t('calendar.projectTimelineViewportPrev')}
                title={t('calendar.projectTimelineViewportPrev')}
              >
                <ChevronLeft size={16} aria-hidden />
              </button>
              <button
                type="button"
                className="tb-btn-secondary p-1.5"
                onClick={() => {
                  viewportAdjustedRef.current = true;
                  setViewportAnchor(new Date());
                }}
                aria-label={t('calendar.projectTimelineViewportToday')}
                title={t('calendar.projectTimelineViewportToday')}
              >
                {t('calendar.projectTimelineViewportToday')}
              </button>
              <button
                type="button"
                className="tb-btn-secondary p-1.5"
                onClick={() => shiftTimetableViewport(3)}
                aria-label={t('calendar.projectTimelineViewportNext')}
                title={t('calendar.projectTimelineViewportNext')}
              >
                <ChevronRight size={16} aria-hidden />
              </button>
            </div>
          </div>
          <ProjectTimelineGrid
            projects={filterProjects}
            timelines={timelinesByProject}
            weekSlots={timetableWeekSlots}
            compactViewport
            onSelectBlock={setBlockDetail}
          />
          <ProjectTimelineBlockDetailDialog
            detail={blockDetail}
            onClose={() => setBlockDetail(null)}
          />
        </>
      ) : null}

      {!loading && !editing && filterProjects.length > 0 && !timetableHasBlocks ? (
        <p className="text-sm tb-muted mt-3">{t('calendar.projectTimelineNoBlocks')}</p>
      ) : null}

      {editing && projectFilter !== 'all' ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--tb-border)] text-left">
                <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wide tb-muted w-[24%]">
                  {t('calendar.projectTimelineColDates')}
                </th>
                <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wide tb-muted w-[12%]">
                  {t('calendar.projectTimelineColType')}
                </th>
                <th className="py-2 pr-3 font-semibold text-xs uppercase tracking-wide tb-muted w-[20%]">
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
                  key={block.client_key}
                  className="border-b border-[var(--tb-border)] align-top"
                >
                  <td className="py-3 pr-3">{renderDateCell(block, index)}</td>
                  <td className="py-3 pr-3 min-w-[8rem] align-top">
                    <select
                      className="field-input text-sm w-full"
                      value={block.entry_kind}
                      disabled={saving}
                      onChange={(e) => {
                        const entry_kind = e.target.value === 'visit' ? 'visit' : 'phase';
                        if (entry_kind === 'phase') {
                          updateBlock(index, {
                            entry_kind,
                            parent_client_key: null,
                            parent_entry_id: null,
                          });
                          return;
                        }
                        const phases = draftBlocks.filter(isTimelinePhase);
                        const parentKey = phases[phases.length - 1]?.client_key ?? null;
                        updateBlock(index, {
                          entry_kind,
                          parent_client_key: parentKey,
                          parent_entry_id: parentKey,
                        });
                      }}
                    >
                      <option value="phase">{t('calendar.projectTimelineTypePhase')}</option>
                      <option value="visit">{t('calendar.projectTimelineTypeVisit')}</option>
                    </select>
                    {block.entry_kind === 'visit' ? (
                      <label className="block mt-2 text-[10px] uppercase tracking-wide tb-muted">
                        {t('calendar.projectTimelineColParentPhase')}
                        <select
                          className="field-input text-sm mt-1 w-full"
                          value={block.parent_client_key ?? ''}
                          disabled={saving || phaseOptionsForDraft.length === 0}
                          onChange={(e) => {
                            const parent_client_key = e.target.value || null;
                            updateBlock(index, {
                              parent_client_key,
                              parent_entry_id: parent_client_key,
                            });
                          }}
                        >
                          {phaseOptionsForDraft.length === 0 ? (
                            <option value="">{t('calendar.projectTimelineNoPhaseForVisit')}</option>
                          ) : (
                            phaseOptionsForDraft.map((opt) => (
                              <option key={opt.key} value={opt.key}>
                                {opt.label}
                              </option>
                            ))
                          )}
                        </select>
                      </label>
                    ) : null}
                  </td>
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
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="tb-btn-secondary text-sm inline-flex items-center gap-2"
                disabled={saving}
                onClick={addBlock}
              >
                <Plus size={16} aria-hidden />
                {t('calendar.projectTimelineAddBlock')}
              </button>
              <button
                type="button"
                className="tb-btn-secondary text-sm inline-flex items-center gap-2"
                disabled={saving}
                onClick={addVisit}
              >
                <Plus size={16} aria-hidden />
                {t('calendar.projectTimelineAddVisit')}
              </button>
            </div>
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
    </section>
  );
}
