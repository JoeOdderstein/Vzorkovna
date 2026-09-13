import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import { useTaskboardFilter } from '../../context/TaskboardFilterContext';
import { useTaskboardRefresh } from '../../context/TaskboardRefreshContext';
import { useTaskboardSelection } from '../../context/TaskboardSelectionContext';
import {
  buildCalendarCells,
  eventLaneHeight,
  layoutEventSegments,
  splitIntoWeeks,
  type CalendarEventSegment,
} from '../../lib/taskboard/calendarEventLayout';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEvents,
  isCalendarEventsReady,
} from '../../lib/taskboard/calendarEventService';
import { filterTasksByAssignee } from '../../lib/taskboard/filterUtils';
import {
  deadlineClasses,
  formatDateKey,
  formatDateRange,
  getDeadlineStatus,
} from '../../lib/taskboard/deadlineUtils';
import {
  fetchAllActiveTasks,
  fetchVisibleProjects,
  filterTasksForProjects,
} from '../../lib/taskboard/taskService';
import type { CalendarEvent, Project, Task } from '../../lib/taskboard/types';

interface TaskCalendarDialogProps {
  open: boolean;
  onClose: () => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_VISIT_TITLE = 'Prague visit';

function segmentClassName(segment: CalendarEventSegment) {
  const classes = ['tb-calendar-visit-segment'];
  if (segment.isEventStart) classes.push('tb-calendar-visit-segment--event-start');
  if (segment.isEventEnd) classes.push('tb-calendar-visit-segment--event-end');
  if (segment.isEventStart && segment.isEventEnd) classes.push('tb-calendar-visit-segment--single');
  return classes.join(' ');
}

export default function TaskCalendarDialog({ open, onClose }: TaskCalendarDialogProps) {
  const { username, isAdmin } = useTaskboardAuth();
  const { assigneeFilter } = useTaskboardFilter();
  const { projectsToken } = useTaskboardRefresh();
  const { openTask } = useTaskboardSelection();

  const [viewDate, setViewDate] = useState(() => new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [eventsReady, setEventsReady] = useState(true);

  const [addFormOpen, setAddFormOpen] = useState(false);
  const [title, setTitle] = useState(DEFAULT_VISIT_TITLE);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCalendarData = useCallback(async () => {
    setError('');
    setLoading(true);

    try {
      const [projectList, allTasks, visitEvents, ready] = await Promise.all([
        fetchVisibleProjects(username, isAdmin),
        fetchAllActiveTasks(),
        fetchCalendarEvents(),
        isCalendarEventsReady(),
      ]);

      setProjects(projectList);
      const visible = filterTasksForProjects(allTasks, projectList);
      setTasks(filterTasksByAssignee(visible, assigneeFilter));
      setEvents(visitEvents);
      setEventsReady(ready);
    } catch {
      setError('Could not load calendar.');
    } finally {
      setLoading(false);
    }
  }, [username, isAdmin, assigneeFilter]);

  useEffect(() => {
    if (!open) return;
    setViewDate(new Date());
    setAddFormOpen(false);
    setTitle(DEFAULT_VISIT_TITLE);
    setStartDate('');
    setEndDate('');
    setFormError('');
    loadCalendarData();
  }, [open, projectsToken, loadCalendarData]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const projectNames = useMemo(
    () => Object.fromEntries(projects.map((project) => [project.id, project.name])),
    [projects]
  );

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.deadline) continue;
      const list = map.get(task.deadline) ?? [];
      list.push(task);
      map.set(task.deadline, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.task_name.localeCompare(b.task_name));
    }
    return map;
  }, [tasks]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const cells = useMemo(() => buildCalendarCells(year, month), [year, month]);
  const weeks = useMemo(() => splitIntoWeeks(cells), [cells]);
  const { segmentsByWeek, maxLanesByWeek } = useMemo(
    () => layoutEventSegments(events, weeks),
    [events, weeks]
  );
  const todayKey = formatDateKey(new Date());

  const handleTaskClick = (task: Task) => {
    openTask(task, task.project_id);
    onClose();
  };

  const openAddForm = () => {
    const today = formatDateKey(new Date());
    setTitle(DEFAULT_VISIT_TITLE);
    setStartDate(today);
    setEndDate(today);
    setFormError('');
    setAddFormOpen(true);
  };

  const handleAddEvent = async (e: FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setFormError('Choose a start and end date.');
      return;
    }
    if (endDate < startDate) {
      setFormError('End date must be on or after the start date.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const created = await createCalendarEvent({
        title: title.trim() || DEFAULT_VISIT_TITLE,
        start_date: startDate,
        end_date: endDate,
      });
      setEvents((prev) => [...prev, created].sort((a, b) => a.start_date.localeCompare(b.start_date)));
      setAddFormOpen(false);
      setTitle(DEFAULT_VISIT_TITLE);
      setStartDate('');
      setEndDate('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save visit.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (event: CalendarEvent) => {
    if (!window.confirm(`Remove "${event.title}" (${formatDateRange(event.start_date, event.end_date)})?`)) {
      return;
    }

    setDeletingId(event.id);
    try {
      await deleteCalendarEvent(event.id);
      setEvents((prev) => prev.filter((item) => item.id !== event.id));
    } catch {
      setError('Could not remove visit.');
    } finally {
      setDeletingId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="taskboard fixed inset-0 z-[80] flex items-center justify-center px-4 sm:px-6">
      <div className="absolute inset-0 tb-overlay" onClick={onClose} />
      <div
        className="relative w-full max-w-5xl tb-calendar-panel max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b tb-calendar-border flex items-center justify-between shrink-0">
          <h2 className="tb-heading">Calendar</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#80868b] hover:text-[#202124] transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewDate(new Date(year, month - 1, 1))}
                className="tb-calendar-nav"
                aria-label="Previous month"
              >
                <ChevronLeft size={18} />
              </button>
              <p className="tb-heading text-base min-w-[10rem] text-center">{monthLabel}</p>
              <button
                type="button"
                onClick={() => setViewDate(new Date(year, month + 1, 1))}
                className="tb-calendar-nav"
                aria-label="Next month"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <button
              type="button"
              onClick={openAddForm}
              className="tb-btn-secondary"
              disabled={!eventsReady}
            >
              + Add event
            </button>
          </div>

          {!eventsReady && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
              Visit events are not set up yet. Run{' '}
              <code className="text-xs">supabase/migrations/008_calendar_events.sql</code> in Supabase
              SQL Editor.
            </p>
          )}

          {addFormOpen && (
            <form
              onSubmit={handleAddEvent}
              className="mb-5 p-4 rounded-lg border tb-calendar-border tb-calendar-form space-y-4"
            >
              <p className="tb-field-label">Add Prague visit</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block space-y-1.5">
                  <span className="tb-field-label">Title</span>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={DEFAULT_VISIT_TITLE}
                    className="field-input w-full"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="tb-field-label">Start date</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="field-input w-full"
                    required
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="tb-field-label">End date</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="field-input w-full"
                    required
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={saving} className="tb-btn-primary disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save visit'}
                </button>
                <button
                  type="button"
                  onClick={() => setAddFormOpen(false)}
                  className="tb-link px-2 py-1"
                >
                  Cancel
                </button>
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
            </form>
          )}

          {loading && <p className="text-sm tb-muted">Loading calendar…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {!loading && !error && (
            <>
              <div className="grid grid-cols-7 gap-px mb-1">
                {WEEKDAYS.map((label) => (
                  <div key={label} className="tb-calendar-weekday">
                    {label}
                  </div>
                ))}
              </div>

              <div className="space-y-px tb-calendar-grid rounded-lg overflow-hidden">
                {weeks.map((week, weekIndex) => {
                  const maxLanes = maxLanesByWeek[weekIndex] ?? 0;
                  const laneAreaHeight = eventLaneHeight(maxLanes);
                  const segments = segmentsByWeek[weekIndex] ?? [];

                  return (
                    <div key={`week-${weekIndex}`} className="tb-calendar-week relative">
                      <div className="grid grid-cols-7 gap-px">
                        {week.map(({ date, key, dateKey }) => {
                          if (!date || !dateKey) {
                            return (
                              <div key={key} className="tb-calendar-cell tb-calendar-cell--empty">
                                <span className="tb-calendar-day opacity-0" aria-hidden>
                                  0
                                </span>
                                <div
                                  className="tb-calendar-event-spacer"
                                  style={{ height: `${laneAreaHeight}rem` }}
                                  aria-hidden
                                />
                              </div>
                            );
                          }

                          const dayTasks = tasksByDate.get(dateKey) ?? [];
                          const isToday = dateKey === todayKey;

                          return (
                            <div
                              key={key}
                              className={`tb-calendar-cell${isToday ? ' tb-calendar-cell--today' : ''}`}
                            >
                              <span className="tb-calendar-day">{date.getDate()}</span>
                              <div
                                className="tb-calendar-event-spacer"
                                style={{ height: `${laneAreaHeight}rem` }}
                                aria-hidden
                              />
                              <ul className="space-y-1">
                                {dayTasks.map((task) => {
                                  const status = getDeadlineStatus(task.deadline, task.completed);
                                  return (
                                    <li key={task.id}>
                                      <button
                                        type="button"
                                        onClick={() => handleTaskClick(task)}
                                        className={`tb-calendar-task ${deadlineClasses[status]}`}
                                        title={`${task.task_name} · ${projectNames[task.project_id] ?? 'Project'}`}
                                      >
                                        <span className="block truncate">
                                          {task.task_name || 'Untitled task'}
                                        </span>
                                        <span className="block truncate text-[10px] opacity-80">
                                          {projectNames[task.project_id] ?? 'Project'}
                                        </span>
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          );
                        })}
                      </div>

                      {maxLanes > 0 && (
                        <div
                          className="tb-calendar-event-layer"
                          style={{
                            height: `${laneAreaHeight}rem`,
                            gridTemplateRows: `repeat(${maxLanes}, 1.375rem)`,
                          }}
                        >
                          {segments.map((segment) => (
                            <div
                              key={`${segment.event.id}-${weekIndex}-${segment.startCol}`}
                              className={segmentClassName(segment)}
                              style={{
                                gridColumn: `${segment.startCol + 1} / span ${segment.span}`,
                                gridRow: segment.lane + 1,
                              }}
                              title={formatDateRange(segment.event.start_date, segment.event.end_date)}
                            >
                              <span className="truncate">{segment.event.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {tasksByDate.size === 0 && events.length === 0 && (
                <p className="text-sm tb-muted mt-4">No deadlines or visits yet.</p>
              )}

              {events.length > 0 && (
                <div className="mt-6">
                  <p className="tb-field-label mb-3">Prague visits</p>
                  <ul className="space-y-2">
                    {events.map((event) => (
                      <li
                        key={event.id}
                        className="flex items-center justify-between gap-3 py-2 border-b tb-calendar-border last:border-0"
                      >
                        <div>
                          <p className="text-sm tb-text">{event.title}</p>
                          <p className="text-xs tb-muted">
                            {formatDateRange(event.start_date, event.end_date)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(event)}
                          disabled={deletingId === event.id}
                          className="p-2 text-[#80868b] hover:text-red-600 transition-colors disabled:opacity-50"
                          aria-label={`Remove ${event.title}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t tb-calendar-border flex justify-end shrink-0">
          <button type="button" onClick={onClose} className="tb-link px-3 py-2">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
