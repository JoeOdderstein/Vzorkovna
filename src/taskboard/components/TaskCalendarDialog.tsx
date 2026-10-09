import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AddTaskDialog from './AddTaskDialog';
import { useAddTaskFlow } from '../hooks/useAddTaskFlow';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import { useTaskboardFilter } from '../../context/TaskboardFilterContext';
import { useTaskboardRefresh } from '../../context/TaskboardRefreshContext';
import { useTaskboardSelection } from '../../context/TaskboardSelectionContext';
import {
  addCalendarDays,
  buildCalendarCells,
  buildWeekCells,
  CALENDAR_LAYOUT,
  eventLaneHeight,
  layoutEventSegments,
  splitIntoWeeks,
  startOfWeekMonday,
  type CalendarCell,
  type CalendarEventSegment,
} from '../../lib/taskboard/calendarEventLayout';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEvents,
  isCalendarEventsReady,
  updateCalendarEvent,
} from '../../lib/taskboard/calendarEventService';
import { filterTasksByAssignee, filterTasksByProject } from '../../lib/taskboard/filterUtils';
import {
  buildProjectCalendarColorIndex,
  projectCalendarColorClassForId,
} from '../../lib/taskboard/calendarProjectColors';
import {
  formatDateKey,
  formatDateRange,
  formatDeadline,
  isDateKeyInRange,
} from '../../lib/taskboard/deadlineUtils';
import {
  fetchActiveTasksWithDeadlines,
  fetchVisibleProjects,
  filterTasksForProjects,
} from '../../lib/taskboard/taskService';
import type { CalendarEvent, Project, Task } from '../../lib/taskboard/types';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';

interface TaskCalendarDialogProps {
  open: boolean;
  onClose?: () => void;
  variant?: 'dialog' | 'page';
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MOBILE_CALENDAR_QUERY = '(max-width: 767px)';
/** Month grid: cap DOM nodes when many deadlines fall on one day. */
const MONTH_CELL_TASK_CAP = 6;
type CalendarViewMode = 'month' | 'week';

function formatWeekRangeLabel(weekCells: CalendarCell[]): string {
  const first = weekCells[0]?.date;
  const last = weekCells[6]?.date;
  if (!first || !last) return '';

  const sameMonth =
    first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
  if (sameMonth) {
    return `${first.toLocaleDateString(undefined, { month: 'long' })} ${first.getDate()} – ${last.getDate()}, ${first.getFullYear()}`;
  }

  const startStr = first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endStr = last.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startStr} – ${endStr}`;
}

function useMobileCalendarLayout() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_CALENDAR_QUERY).matches : false
  );

  useEffect(() => {
    const media = window.matchMedia(MOBILE_CALENDAR_QUERY);
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return mobile;
}

function segmentClassName(segment: CalendarEventSegment) {
  const classes = ['tb-calendar-visit-segment'];
  if (segment.isEventStart) classes.push('tb-calendar-visit-segment--event-start');
  if (segment.isEventEnd) classes.push('tb-calendar-visit-segment--event-end');
  if (segment.isEventStart && segment.isEventEnd) classes.push('tb-calendar-visit-segment--single');
  return classes.join(' ');
}

function visitSegmentButton(
  segment: CalendarEventSegment,
  key: string,
  gridStyle: { gridColumn: string; gridRow: number },
  onSelect: (event: CalendarEvent) => void
) {
  return (
    <button
      type="button"
      key={key}
      className={segmentClassName(segment)}
      style={gridStyle}
      onClick={() => onSelect(segment.event)}
      title={formatDateRange(segment.event.start_date, segment.event.end_date)}
    >
      <span className="truncate">{segment.event.title}</span>
    </button>
  );
}

function formatAgendaDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function visitsOnDate(events: CalendarEvent[], dateKey: string) {
  return events.filter((event) => isDateKeyInRange(dateKey, event.start_date, event.end_date));
}

export default function TaskCalendarDialog({
  open,
  onClose,
  variant = 'dialog',
}: TaskCalendarDialogProps) {
  const isPage = variant === 'page';
  const isActive = isPage || open;
  const mobileCalendar = useMobileCalendarLayout();
  const { username, isAdmin } = useTaskboardAuth();
  const { assigneeFilter, projectFilter, setTasksForCounts, setFilterProjects } =
    useTaskboardFilter();
  const { projectsToken } = useTaskboardRefresh();
  const { openTask } = useTaskboardSelection();
  const { t } = useTaskboardI18n();

  const onTaskCreated = useCallback(
    (task: Task) => {
      openTask(task, task.project_id);
    },
    [openTask]
  );
  const { addTaskOpen, setAddTaskOpen, handleCreateTask } = useAddTaskFlow({
    onCreated: onTaskCreated,
  });
  const defaultAddTaskProjectId = projectFilter !== 'all' ? projectFilter : undefined;

  const [viewDate, setViewDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [visibleTasksUnfiltered, setVisibleTasksUnfiltered] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [eventsReady, setEventsReady] = useState(true);

  const [addFormOpen, setAddFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const eventsReadyChecked = useRef(false);
  const hasLoadedTasksOnce = useRef(false);

  const tasks = useMemo(() => {
    const byAssignee = filterTasksByAssignee(visibleTasksUnfiltered, assigneeFilter);
    return filterTasksByProject(byAssignee, projectFilter);
  }, [visibleTasksUnfiltered, assigneeFilter, projectFilter]);

  const loadCalendarData = useCallback(async () => {
    setError('');
    if (!hasLoadedTasksOnce.current) {
      setLoading(true);
    }

    try {
      const [projectList, deadlineTasks, visitEvents] = await Promise.all([
        fetchVisibleProjects(username, isAdmin),
        fetchActiveTasksWithDeadlines(),
        fetchCalendarEvents(),
      ]);

      setProjects(projectList);
      setFilterProjects(projectList);
      const visible = filterTasksForProjects(deadlineTasks, projectList);
      setVisibleTasksUnfiltered(visible);
      setTasksForCounts(visible);
      setEvents(visitEvents);
      hasLoadedTasksOnce.current = true;
    } catch {
      setError('Could not load calendar.');
    } finally {
      setLoading(false);
    }
  }, [username, isAdmin, setTasksForCounts, setFilterProjects]);

  useEffect(() => {
    if (!isActive) return;
    if (!isPage) {
      setViewDate(new Date());
      setAddFormOpen(false);
      setTitle('');
      setStartDate('');
      setEndDate('');
      setFormError('');
    }
    loadCalendarData();
  }, [isActive, isPage, projectsToken, loadCalendarData]);

  useEffect(() => {
    if (!isActive || eventsReadyChecked.current) return;
    eventsReadyChecked.current = true;
    void isCalendarEventsReady().then(setEventsReady);
  }, [isActive]);

  useEffect(() => {
    if (!open || isPage) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, isPage, onClose]);

  const projectNames = useMemo(
    () => Object.fromEntries(projects.map((project) => [project.id, project.name])),
    [projects]
  );

  const projectColorIndex = useMemo(
    () => buildProjectCalendarColorIndex(projects),
    [projects]
  );

  const taskProjectColorClass = useCallback(
    (projectId: string) => projectCalendarColorClassForId(projectId, projectColorIndex),
    [projectColorIndex]
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
  const monthWeeks = useMemo(
    () => splitIntoWeeks(buildCalendarCells(year, month)),
    [year, month]
  );
  const weekCells = useMemo(() => buildWeekCells(viewDate), [viewDate]);
  const displayWeeks = viewMode === 'week' ? [weekCells] : monthWeeks;
  const { segmentsByWeek, maxLanesByWeek } = useMemo(
    () => layoutEventSegments(events, displayWeeks),
    [events, displayWeeks]
  );
  const periodLabel = viewMode === 'month' ? monthLabel : formatWeekRangeLabel(weekCells);
  const weekStartKey = weekCells[0]?.dateKey;
  const weekEndKey = weekCells[6]?.dateKey;

  const goToPreviousPeriod = () => {
    if (viewMode === 'month') {
      setViewDate(new Date(year, month - 1, 1));
      return;
    }
    setViewDate(addCalendarDays(startOfWeekMonday(viewDate), -7));
  };

  const goToNextPeriod = () => {
    if (viewMode === 'month') {
      setViewDate(new Date(year, month + 1, 1));
      return;
    }
    setViewDate(addCalendarDays(startOfWeekMonday(viewDate), 7));
  };
  const todayKey = formatDateKey(new Date());
  const laneHeight = CALENDAR_LAYOUT.desktop.laneHeight;
  const weekVisitLaneCount =
    viewMode === 'week' && !mobileCalendar ? (maxLanesByWeek[0] ?? 0) : 0;
  const weekVisitLaneAreaHeight = eventLaneHeight(weekVisitLaneCount);
  const weekVisitSegments =
    viewMode === 'week' && !mobileCalendar ? (segmentsByWeek[0] ?? []) : [];
  const monthTaskEntries = useMemo(() => {
    const entries: [string, Task[]][] = [];
    for (const [dateKey, dayTasks] of tasksByDate) {
      const [entryYear, entryMonth] = dateKey.split('-').map(Number);
      if (entryYear === year && entryMonth === month + 1) {
        entries.push([dateKey, dayTasks]);
      }
    }
    entries.sort(([a], [b]) => a.localeCompare(b));
    return entries;
  }, [tasksByDate, year, month]);

  const weekTaskEntries = useMemo(() => {
    const entries: [string, Task[]][] = [];
    for (const cell of weekCells) {
      if (!cell.dateKey) continue;
      const dayTasks = tasksByDate.get(cell.dateKey);
      if (dayTasks?.length) entries.push([cell.dateKey, dayTasks]);
    }
    return entries;
  }, [weekCells, tasksByDate]);

  const eventsInView = useMemo(() => {
    if (viewMode === 'month') return events;
    if (!weekStartKey || !weekEndKey) return events;
    return events.filter(
      (event) => event.end_date >= weekStartKey && event.start_date <= weekEndKey
    );
  }, [events, viewMode, weekStartKey, weekEndKey]);

  const isViewEmpty = useMemo(() => {
    if (viewMode === 'month') {
      return monthTaskEntries.length === 0 && events.length === 0;
    }
    return weekTaskEntries.length === 0 && eventsInView.length === 0;
  }, [viewMode, monthTaskEntries, events.length, weekTaskEntries, eventsInView.length]);

  const mobileAgendaEntries = viewMode === 'week' ? weekTaskEntries : monthTaskEntries;

  const handleTaskClick = (task: Task) => {
    openTask(task, task.project_id);
    if (!isPage) onClose?.();
  };

  const closeEventForm = () => {
    setAddFormOpen(false);
    setEditingEvent(null);
    setTitle('');
    setStartDate('');
    setEndDate('');
    setFormError('');
  };

  const openAddForm = () => {
    const today = formatDateKey(new Date());
    setEditingEvent(null);
    setTitle(t('calendar.defaultEventTitle'));
    setStartDate(today);
    setEndDate(today);
    setFormError('');
    setAddFormOpen(true);
  };

  const openEditEvent = (event: CalendarEvent) => {
    setAddFormOpen(false);
    setEditingEvent(event);
    setTitle(event.title);
    setStartDate(event.start_date);
    setEndDate(event.end_date);
    setFormError('');
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
        title: title.trim() || t('calendar.defaultEventTitle'),
        start_date: startDate,
        end_date: endDate,
      });
      setEvents((prev) => [...prev, created].sort((a, b) => a.start_date.localeCompare(b.start_date)));
      closeEventForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save event.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEvent = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
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
      const updated = await updateCalendarEvent(editingEvent.id, {
        title: title.trim() || t('calendar.defaultEventTitle'),
        start_date: startDate,
        end_date: endDate,
      });
      setEvents((prev) =>
        prev
          .map((item) => (item.id === updated.id ? updated : item))
          .sort((a, b) => a.start_date.localeCompare(b.start_date))
      );
      closeEventForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save event.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEditingEvent = async () => {
    if (!editingEvent) return;
    const dates = formatDateRange(editingEvent.start_date, editingEvent.end_date);
    if (
      !window.confirm(
        t('calendar.deleteEventConfirm', { title: editingEvent.title, dates })
      )
    ) {
      return;
    }

    setDeletingId(editingEvent.id);
    try {
      await deleteCalendarEvent(editingEvent.id);
      setEvents((prev) => prev.filter((item) => item.id !== editingEvent.id));
      closeEventForm();
    } catch {
      setError('Could not remove event.');
    } finally {
      setDeletingId(null);
    }
  };

  const eventFormOpen = addFormOpen || editingEvent !== null;
  const isEditingEvent = editingEvent !== null;

  if (!isActive) return null;

  const panel = (
    <div
      className={`relative w-full tb-calendar-panel flex flex-col${
        viewMode === 'week' && !mobileCalendar ? ' max-w-none' : ' max-w-5xl'
      }${isPage ? '' : ' max-h-[90vh]'}${
        mobileCalendar ? ' tb-calendar-panel--mobile' : ''
      }${viewMode === 'week' ? ' tb-calendar-panel--week-view' : ''}`}
      onClick={isPage ? undefined : (e) => e.stopPropagation()}
    >
      {!isPage ? (
        <div className="px-6 py-4 border-b tb-calendar-border flex items-center justify-between shrink-0">
          <h2 className="tb-heading">{t('header.calendar')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#80868b] hover:text-[#202124] transition-colors"
            aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
        </div>
      ) : null}

        <div className="px-6 py-5 overflow-y-auto flex-1">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div className="flex flex-wrap items-center gap-3">
              <div
                className="tb-calendar-view-toggle"
                role="group"
                aria-label={t('header.calendar')}
              >
                <button
                  type="button"
                  className={`tb-calendar-view-toggle__btn${
                    viewMode === 'month' ? ' tb-calendar-view-toggle__btn--active' : ''
                  }`}
                  aria-pressed={viewMode === 'month'}
                  onClick={() => setViewMode('month')}
                >
                  {t('calendar.viewMonth')}
                </button>
                <button
                  type="button"
                  className={`tb-calendar-view-toggle__btn${
                    viewMode === 'week' ? ' tb-calendar-view-toggle__btn--active' : ''
                  }`}
                  aria-pressed={viewMode === 'week'}
                  onClick={() => setViewMode('week')}
                >
                  {t('calendar.viewWeek')}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goToPreviousPeriod}
                  className="tb-calendar-nav"
                  aria-label={
                    viewMode === 'month' ? t('calendar.prevMonth') : t('calendar.prevWeek')
                  }
                >
                  <ChevronLeft size={18} />
                </button>
                <p className="tb-heading text-base min-w-[10rem] text-center">{periodLabel}</p>
                <button
                  type="button"
                  onClick={goToNextPeriod}
                  className="tb-calendar-nav"
                  aria-label={viewMode === 'month' ? t('calendar.nextMonth') : t('calendar.nextWeek')}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setViewDate(new Date())}
                className="tb-btn-secondary text-xs uppercase tracking-wide"
              >
                {t('calendar.today')}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setAddTaskOpen(true)}
                className="tb-btn-primary whitespace-nowrap"
              >
                {t('header.addTask')}
              </button>
              <button
                type="button"
                onClick={openAddForm}
                className="tb-btn-secondary whitespace-nowrap"
                disabled={!eventsReady}
              >
                + Add event
              </button>
            </div>
          </div>

          {!eventsReady && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
              {t('calendar.eventsNotReady')}
            </p>
          )}

          {eventFormOpen && (
            <form
              onSubmit={isEditingEvent ? handleUpdateEvent : handleAddEvent}
              className="mb-5 p-4 rounded-lg border tb-calendar-border tb-calendar-form space-y-4"
            >
              <p className="tb-field-label">
                {isEditingEvent ? t('calendar.editEvent') : t('calendar.addEventForm')}
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block space-y-1.5">
                  <span className="tb-field-label">Title</span>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t('calendar.defaultEventTitle')}
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
                  {saving
                    ? t('common.saving')
                    : isEditingEvent
                      ? t('calendar.saveChanges')
                      : t('calendar.saveEvent')}
                </button>
                {isEditingEvent && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteEditingEvent()}
                    disabled={saving || deletingId === editingEvent?.id}
                    className="tb-btn-secondary text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
                  >
                    {t('calendar.deleteEvent')}
                  </button>
                )}
                <button type="button" onClick={closeEventForm} className="tb-link px-2 py-1">
                  {t('common.cancel')}
                </button>
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
            </form>
          )}

          {loading && <p className="text-sm tb-muted">Loading calendar…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {!loading && !error && (
            <>
              {viewMode === 'week' && !mobileCalendar ? (
                <div className="tb-calendar-week-layout">
                  <div className="tb-calendar-week-columns">
                    {weekCells.map(({ date, dateKey, key }, colIndex) => {
                      if (!date || !dateKey) return null;

                      const dayTasks = tasksByDate.get(dateKey) ?? [];
                      const isToday = dateKey === todayKey;
                      const weekdayLabel = date.toLocaleDateString(undefined, { weekday: 'long' });
                      const hasVisitOnDay = weekVisitSegments.some(
                        (segment) =>
                          colIndex >= segment.startCol &&
                          colIndex <= segment.startCol + segment.span - 1
                      );

                      return (
                        <section
                          key={key}
                          className={`tb-calendar-week-day${
                            isToday ? ' tb-calendar-week-day--today' : ''
                          }`}
                          aria-label={formatAgendaDate(dateKey)}
                        >
                          <header className="tb-calendar-week-day-head">
                            <p className="tb-calendar-week-day-name">{weekdayLabel}</p>
                            <p className="tb-calendar-week-day-date">{date.getDate()}</p>
                            <p className="tb-calendar-week-day-month">
                              {date.toLocaleDateString(undefined, { month: 'short' })}
                            </p>
                          </header>
                          <div
                            className="tb-calendar-week-visit-spacer"
                            style={{ height: `${weekVisitLaneAreaHeight}rem` }}
                            aria-hidden
                          />
                          <div className="tb-calendar-week-day-body">
                            {dayTasks.length === 0 && !hasVisitOnDay ? (
                              <p className="text-xs tb-muted py-2">{t('calendar.weekDayEmpty')}</p>
                            ) : dayTasks.length === 0 ? null : (
                              <ul className="space-y-2">
                                {dayTasks.map((task) => {
                                  const projectLabel =
                                    projectNames[task.project_id] ?? t('common.project');
                                  const assigneeLabel =
                                    task.assignees?.length > 0
                                      ? task.assignees.join(', ')
                                      : null;

                                  return (
                                    <li key={task.id}>
                                      <button
                                        type="button"
                                        onClick={() => handleTaskClick(task)}
                                        className={`tb-calendar-week-task ${taskProjectColorClass(task.project_id)}`}
                                      >
                                        <span className="tb-calendar-week-task-title">
                                          {task.task_name || 'Untitled task'}
                                        </span>
                                        <span className="tb-calendar-week-task-meta">
                                          {projectLabel}
                                        </span>
                                        {assigneeLabel && (
                                          <span className="tb-calendar-week-task-meta">
                                            {t('task.assignedTo')}: {assigneeLabel}
                                          </span>
                                        )}
                                        {task.deadline && (
                                          <span className="tb-calendar-week-task-meta">
                                            {t('task.deadline')}: {formatDeadline(task.deadline)}
                                          </span>
                                        )}
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                  {weekVisitLaneCount > 0 && (
                    <div
                      className="tb-calendar-week-event-layer"
                      style={{
                        height: `${weekVisitLaneAreaHeight}rem`,
                        gridTemplateRows: `repeat(${weekVisitLaneCount}, ${laneHeight}rem)`,
                      }}
                    >
                      {weekVisitSegments.map((segment) =>
                        visitSegmentButton(
                          segment,
                          `week-visit-${segment.event.id}-${segment.startCol}`,
                          {
                            gridColumn: `${segment.startCol + 1} / span ${segment.span}`,
                            gridRow: segment.lane + 1,
                          },
                          openEditEvent
                        )
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
              {!(viewMode === 'week' && mobileCalendar) && (
                <>
              <div className="grid grid-cols-7 gap-px mb-1">
                {WEEKDAYS.map((label) => (
                  <div key={label} className="tb-calendar-weekday">
                    {label}
                  </div>
                ))}
              </div>

              <div className="space-y-px tb-calendar-grid rounded-lg overflow-hidden">
                {displayWeeks.map((week, weekIndex) => {
                  const maxLanes = maxLanesByWeek[weekIndex] ?? 0;
                  const laneAreaHeight = mobileCalendar ? 0 : eventLaneHeight(maxLanes);
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
                          const taskCap =
                            viewMode === 'month' && !mobileCalendar
                              ? MONTH_CELL_TASK_CAP
                              : dayTasks.length;
                          const shownTasks = dayTasks.slice(0, taskCap);
                          const hiddenTaskCount = dayTasks.length - shownTasks.length;

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
                              {mobileCalendar ? (
                                <>
                                  {dayTasks.length > 0 && (
                                    <span
                                      className="tb-calendar-mobile-indicator"
                                      aria-label={`${dayTasks.length} deadline${dayTasks.length === 1 ? '' : 's'}`}
                                    >
                                      {dayTasks.length}
                                    </span>
                                  )}
                                  {visitsOnDate(events, dateKey).map((visit) => (
                                    <button
                                      key={visit.id}
                                      type="button"
                                      onClick={() => openEditEvent(visit)}
                                      className="tb-calendar-week-visit text-[0.625rem] w-full mt-1 px-1 py-0.5 truncate"
                                    >
                                      {visit.title}
                                    </button>
                                  ))}
                                </>
                              ) : (
                                <ul className="space-y-1">
                                  {shownTasks.map((task) => {
                                    const projectLabel =
                                      projectNames[task.project_id] ?? t('common.project');
                                    return (
                                      <li key={task.id}>
                                        <button
                                          type="button"
                                          onClick={() => handleTaskClick(task)}
                                          className={`tb-calendar-task ${taskProjectColorClass(task.project_id)}`}
                                          title={`${task.task_name} · ${projectLabel}`}
                                        >
                                          <span className="block truncate">
                                            {task.task_name || 'Untitled task'}
                                          </span>
                                          <span className="block truncate tb-calendar-task-sub opacity-80">
                                            {projectLabel}
                                          </span>
                                        </button>
                                      </li>
                                    );
                                  })}
                                  {hiddenTaskCount > 0 && (
                                    <li className="text-[0.625rem] tb-muted px-0.5">
                                      {t('calendar.moreDeadlines', {
                                        count: String(hiddenTaskCount),
                                      })}
                                    </li>
                                  )}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {!mobileCalendar && maxLanes > 0 && (
                        <div
                          className="tb-calendar-event-layer"
                          style={{
                            height: `${laneAreaHeight}rem`,
                            gridTemplateRows: `repeat(${maxLanes}, ${laneHeight}rem)`,
                          }}
                        >
                          {segments.map((segment) =>
                            visitSegmentButton(
                              segment,
                              `${segment.event.id}-${weekIndex}-${segment.startCol}`,
                              {
                                gridColumn: `${segment.startCol + 1} / span ${segment.span}`,
                                gridRow: segment.lane + 1,
                              },
                              openEditEvent
                            )
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
                </>
              )}

              {mobileCalendar && mobileAgendaEntries.length > 0 && (
                <div
                  className={`tb-calendar-mobile-agenda mt-5${
                    viewMode === 'week' ? ' tb-calendar-mobile-agenda--week' : ''
                  }`}
                >
                  <p className="tb-field-label mb-3">
                    {viewMode === 'week'
                      ? t('calendar.deadlinesThisWeek')
                      : t('calendar.deadlinesThisMonth')}
                  </p>
                  <ul className="space-y-4">
                    {mobileAgendaEntries.map(([dateKey, dayTasks]) => {
                      const dayVisits = visitsOnDate(events, dateKey);
                      return (
                      <li key={dateKey}>
                        <p className="tb-calendar-agenda-date">{formatAgendaDate(dateKey)}</p>
                        {dayVisits.length > 0 && (
                          <ul className="space-y-1.5 mt-2 mb-2">
                            {dayVisits.map((visit) => (
                              <li key={visit.id}>
                                <button
                                  type="button"
                                  onClick={() => openEditEvent(visit)}
                                  className="tb-calendar-week-visit text-sm w-full text-left"
                                >
                                  {visit.title}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <ul className="space-y-2 mt-1.5">
                          {dayTasks.map((task) => {
                            const projectLabel =
                              projectNames[task.project_id] ?? t('common.project');
                            const assigneeLabel =
                              task.assignees?.length > 0 ? task.assignees.join(', ') : null;
                            const useWeekStyle = viewMode === 'week';
                            const colorClass = taskProjectColorClass(task.project_id);

                            return (
                              <li key={task.id}>
                                <button
                                  type="button"
                                  onClick={() => handleTaskClick(task)}
                                  className={
                                    useWeekStyle
                                      ? `tb-calendar-week-task w-full ${colorClass}`
                                      : `tb-calendar-agenda-task ${colorClass}`
                                  }
                                >
                                  <span
                                    className={
                                      useWeekStyle
                                        ? 'tb-calendar-week-task-title'
                                        : 'block font-medium'
                                    }
                                  >
                                    {task.task_name || 'Untitled task'}
                                  </span>
                                  <span
                                    className={
                                      useWeekStyle
                                        ? 'tb-calendar-week-task-meta'
                                        : 'block tb-calendar-agenda-task-sub opacity-80'
                                    }
                                  >
                                    {projectLabel}
                                  </span>
                                  {useWeekStyle && assigneeLabel && (
                                    <span className="tb-calendar-week-task-meta">
                                      {t('task.assignedTo')}: {assigneeLabel}
                                    </span>
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    );
                    })}
                  </ul>
                </div>
              )}

                </>
              )}

              {isViewEmpty && (
                <p className="text-sm tb-muted mt-4">{t('calendar.emptySchedule')}</p>
              )}

            </>
          )}
        </div>

      {!isPage ? (
        <div className="px-6 py-4 border-t tb-calendar-border flex justify-end shrink-0">
          <button type="button" onClick={onClose} className="tb-link px-3 py-2">
            {t('common.close')}
          </button>
        </div>
      ) : null}
    </div>
  );

  const addTaskDialog = (
    <AddTaskDialog
      open={addTaskOpen}
      onClose={() => setAddTaskOpen(false)}
      onCreate={handleCreateTask}
      defaultProjectId={defaultAddTaskProjectId}
    />
  );

  if (isPage) {
    return (
      <>
        {panel}
        {addTaskDialog}
      </>
    );
  }

  return (
    <div className="taskboard fixed inset-0 z-[80] flex items-center justify-center px-4 sm:px-6">
      <div className="absolute inset-0 tb-overlay" onClick={onClose} />
      {panel}
      {addTaskDialog}
    </div>
  );
}
