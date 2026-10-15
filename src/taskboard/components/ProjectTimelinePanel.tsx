import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link2, Pencil } from 'lucide-react';
import { useTaskboardFilter } from '../../context/TaskboardFilterContext';
import { useTaskboardRefresh } from '../../context/TaskboardRefreshContext';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import {
  fetchProjectTimeline,
  saveProjectTimeline,
  type ProjectTimelineRowInput,
} from '../../lib/taskboard/projectTimelineService';
import { calendarProjectTimelineUrl } from '../../lib/taskboard/calendarProjectUrl';
import {
  buildTimelineWeekSlots,
  PROJECT_TIMELINE_WEEKS_AHEAD,
} from '../../lib/taskboard/projectTimelineUtils';

type DraftRow = ProjectTimelineRowInput;

function emptyDraftForWeeks(weekKeys: string[]): DraftRow[] {
  return weekKeys.map((week_start) => ({ week_start, name: '', description: '' }));
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
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);

  const weekSlots = useMemo(() => buildTimelineWeekSlots(PROJECT_TIMELINE_WEEKS_AHEAD), []);

  const selectedProject = useMemo(
    () => filterProjects.find((project) => project.id === projectFilter) ?? null,
    [filterProjects, projectFilter]
  );

  const entryByWeek = useMemo(() => {
    const map = new Map<string, { name: string; description: string }>();
    for (const row of draftRows) {
      map.set(row.week_start, { name: row.name, description: row.description });
    }
    return map;
  }, [draftRows]);

  const loadTimeline = useCallback(async () => {
    if (projectFilter === 'all' || !selectedProject) {
      setTimelineCompleted(false);
      setDraftRows(emptyDraftForWeeks(weekSlots.map((w) => w.weekStartKey)));
      setEditing(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const state = await fetchProjectTimeline(projectFilter);
      setTimelineCompleted(state.timelineCompleted);
      setDraftCompleted(state.timelineCompleted);
      const byWeek = new Map(state.entries.map((e) => [e.week_start, e]));
      setDraftRows(
        weekSlots.map((slot) => {
          const existing = byWeek.get(slot.weekStartKey);
          return {
            week_start: slot.weekStartKey,
            name: existing?.name ?? '',
            description: existing?.description ?? '',
          };
        })
      );
    } catch {
      setError(t('calendar.projectTimelineLoadError'));
      setDraftRows(emptyDraftForWeeks(weekSlots.map((w) => w.weekStartKey)));
    } finally {
      setLoading(false);
    }
  }, [projectFilter, selectedProject, weekSlots, t]);

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
  };

  const cancelEdit = () => {
    setEditing(false);
    void loadTimeline();
  };

  const saveTimeline = async () => {
    if (projectFilter === 'all') return;
    setSaving(true);
    setError('');
    try {
      const state = await saveProjectTimeline(projectFilter, draftRows, draftCompleted);
      setTimelineCompleted(state.timelineCompleted);
      setDraftCompleted(state.timelineCompleted);
      const byWeek = new Map(state.entries.map((e) => [e.week_start, e]));
      setDraftRows(
        weekSlots.map((slot) => {
          const existing = byWeek.get(slot.weekStartKey);
          return {
            week_start: slot.weekStartKey,
            name: existing?.name ?? '',
            description: existing?.description ?? '',
          };
        })
      );
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

  const updateDraftRow = (weekStart: string, patch: Partial<Pick<DraftRow, 'name' | 'description'>>) => {
    setDraftRows((prev) =>
      prev.map((row) => (row.week_start === weekStart ? { ...row, ...patch } : row))
    );
  };

  const showTable = projectFilter !== 'all' && !loading && (!timelineCompleted || editing);

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

      {showTable ? (
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
              </tr>
            </thead>
            <tbody>
              {weekSlots.map((slot) => {
                const row = entryByWeek.get(slot.weekStartKey);
                const name = row?.name ?? '';
                const description = row?.description ?? '';
                const hasContent = Boolean(name.trim() || description.trim());

                return (
                  <tr
                    key={slot.weekStartKey}
                    className="border-b border-[var(--tb-border)] align-top"
                  >
                    <td className="py-3 pr-3 text-xs tb-muted whitespace-nowrap">{slot.label}</td>
                    <td className="py-3 pr-3">
                      {editing ? (
                        <input
                          type="text"
                          className="field-input w-full text-sm"
                          value={name}
                          disabled={saving}
                          onChange={(e) =>
                            updateDraftRow(slot.weekStartKey, { name: e.target.value })
                          }
                          aria-label={`${t('calendar.projectTimelineColName')} — ${slot.label}`}
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
                          onChange={(e) =>
                            updateDraftRow(slot.weekStartKey, { description: e.target.value })
                          }
                          aria-label={`${t('calendar.projectTimelineColDescription')} — ${slot.label}`}
                        />
                      ) : (
                        <span className={`whitespace-pre-wrap ${hasContent ? '' : 'tb-muted'}`}>
                          {description.trim() || '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {projectFilter !== 'all' && !loading && editing ? (
        <div className="mt-5 space-y-4 border-t border-[var(--tb-border)] pt-4">
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
