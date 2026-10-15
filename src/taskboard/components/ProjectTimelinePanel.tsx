import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTaskboardFilter } from '../../context/TaskboardFilterContext';
import { useTaskboardRefresh } from '../../context/TaskboardRefreshContext';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { calendarProjectTimelineUrl } from '../../lib/taskboard/calendarProjectUrl';
import {
  fetchProjectTimeline,
  saveProjectTimeline,
  type ProjectTimelineBlockInput,
} from '../../lib/taskboard/projectTimelineService';
import {
  buildTimelineWeekSlots,
  formatTimelineWeekStartDate,
  isoWeekNumber,
  normalizeTimelineBlocksForSave,
  PROJECT_TIMELINE_WEEKS_AHEAD,
  sortTimelineBlocks,
  timelineSlotsInBlockRange,
  validateTimelineBlocks,
} from '../../lib/taskboard/projectTimelineUtils';

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

  const weekSlots = useMemo(() => buildTimelineWeekSlots(PROJECT_TIMELINE_WEEKS_AHEAD), []);
  const weekKeys = useMemo(() => weekSlots.map((s) => s.weekStartKey), [weekSlots]);

  const selectedProject = useMemo(
    () => filterProjects.find((project) => project.id === projectFilter) ?? null,
    [filterProjects, projectFilter]
  );

  const displayBlocks = useMemo(
    () => sortTimelineBlocks(draftBlocks.filter((b) => b.name.trim() || b.description.trim())),
    [draftBlocks]
  );

  const loadTimeline = useCallback(async () => {
    if (projectFilter === 'all' || !selectedProject) {
      setTimelineCompleted(false);
      setDraftBlocks([]);
      setEditing(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const state = await fetchProjectTimeline(projectFilter);
      setTimelineCompleted(state.timelineCompleted);
      setDraftCompleted(state.timelineCompleted);
      setDraftBlocks(entriesToBlocks(state.entries));
    } catch {
      setError(t('calendar.projectTimelineLoadError'));
      setDraftBlocks([]);
    } finally {
      setLoading(false);
    }
  }, [projectFilter, selectedProject, t]);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  useEffect(() => {
    setEditing(false);
    setShareNotice('');
  }, [projectFilter]);

  const startEdit = () => {
    setDraftCompleted(timelineCompleted);
    setEditing(true);
    setError('');
    if (draftBlocks.length === 0 && weekKeys[0]) {
      setDraftBlocks([newEmptyBlock(weekKeys[0])]);
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    void loadTimeline();
  };

  const saveTimeline = async () => {
    if (projectFilter === 'all') return;

    const normalized = normalizeTimelineBlocksForSave(draftBlocks, weekKeys);
    const validationKey = validateTimelineBlocks(normalized, weekKeys);
    if (validationKey) {
      setError(t(validationKey));
      return;
    }

    setSaving(true);
    setError('');
    try {
      const state = await saveProjectTimeline(projectFilter, normalized, draftCompleted);
      setTimelineCompleted(state.timelineCompleted);
      setDraftCompleted(state.timelineCompleted);
      setDraftBlocks(entriesToBlocks(state.entries));
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

  const updateBlock = (
    index: number,
    patch: Partial<ProjectTimelineBlockInput>
  ) => {
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

  const showTable =
    projectFilter !== 'all' && !loading && (!timelineCompleted || editing);

  const renderWeekLines = (block: ProjectTimelineBlockInput) => {
    const slots = timelineSlotsInBlockRange(block.week_start, block.week_end, weekSlots);
    return (
      <ul className="space-y-1.5 list-none p-0 m-0">
        {slots.map((slot) => (
          <li key={slot.weekStartKey} className="text-xs tb-muted leading-snug">
            {t('calendar.projectTimelineWeekLine', {
              number: isoWeekNumber(slot.weekStart),
              date: formatTimelineWeekStartDate(slot.weekStart),
            })}
          </li>
        ))}
      </ul>
    );
  };

  const renderWeekCell = (block: ProjectTimelineBlockInput, index: number) => {
    if (editing) {
      return (
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
    }

    return renderWeekLines(block);
  };

  const blocksToRender = editing ? draftBlocks : displayBlocks;

  return (
    <section className="tb-remote-inst-card p-6 md:p-8 mb-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <h2 className="tb-heading text-lg">{t('calendar.projectTimelineHeading')}</h2>
          {selectedProject ? (
            <p className="text-sm tb-muted mt-1">{selectedProject.name}</p>
          ) : (
            <p className="text-sm tb-muted mt-1">{t('calendar.projectTimelineSelectProject')}</p>
          )}
        </div>
        {projectFilter !== 'all' && !loading && !editing ? (
          <div className="flex items-center gap-2 shrink-0">
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
              aria-label={t('calendar.projectTimelineEdit')}
              title={t('calendar.projectTimelineEdit')}
            >
              <Pencil size={18} aria-hidden />
            </button>
          </div>
        ) : null}
      </div>

      {projectFilter === 'all' ? (
        <p className="text-sm tb-muted mt-3">{t('calendar.projectTimelinePickProject')}</p>
      ) : null}

      {projectFilter !== 'all' && loading ? (
        <p className="text-sm tb-muted mt-3">{t('common.loading')}</p>
      ) : null}

      {projectFilter !== 'all' && !loading && timelineCompleted && !editing ? (
        <p className="text-sm font-medium text-[var(--tb-text)] mt-3">
          {t('calendar.projectTimelineCompleted')}
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-600 mt-3">{error}</p> : null}
      {shareNotice ? <p className="text-sm text-[var(--tb-accent)] mt-3">{shareNotice}</p> : null}

      {showTable && blocksToRender.length === 0 && !editing ? (
        <p className="text-sm tb-muted mt-3">{t('calendar.projectTimelineNoBlocks')}</p>
      ) : null}

      {showTable && (blocksToRender.length > 0 || editing) ? (
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
                {editing ? <th className="w-10" aria-hidden /> : null}
              </tr>
            </thead>
            <tbody>
              {blocksToRender.map((block, index) => {
                const name = block.name;
                const description = block.description;
                const hasContent = Boolean(name.trim() || description.trim());

                return (
                  <tr
                    key={`${block.week_start}-${block.week_end}-${index}`}
                    className="border-b border-[var(--tb-border)] align-top"
                  >
                    <td className="py-3 pr-3">{renderWeekCell(block, index)}</td>
                    <td className="py-3 pr-3">
                      {editing ? (
                        <input
                          type="text"
                          className="field-input w-full text-sm"
                          value={name}
                          disabled={saving}
                          onChange={(e) => updateBlock(index, { name: e.target.value })}
                        />
                      ) : (
                        <span className={hasContent ? '' : 'tb-muted'}>
                          {name.trim() || '—'}
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      {editing ? (
                        <textarea
                          className="field-input w-full text-sm min-h-[2.5rem] resize-y"
                          value={description}
                          disabled={saving}
                          rows={2}
                          onChange={(e) => updateBlock(index, { description: e.target.value })}
                        />
                      ) : (
                        <span className={`whitespace-pre-wrap ${hasContent ? '' : 'tb-muted'}`}>
                          {description.trim() || '—'}
                        </span>
                      )}
                    </td>
                    {editing ? (
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
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {projectFilter !== 'all' && !loading && editing ? (
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
      ) : null}

      {projectFilter !== 'all' && !loading && !timelineCompleted && !editing ? (
        <p className="text-xs tb-muted mt-3">{t('calendar.projectTimelineEditHint')}</p>
      ) : null}
    </section>
  );
}
