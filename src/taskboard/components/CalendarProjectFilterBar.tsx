import { useEffect, useMemo } from 'react';
import { useTaskboardFilter } from '../../context/TaskboardFilterContext';
import {
  filterTasksByAssignee,
  sortProjectsByWorkload,
  type ProjectFilter,
} from '../../lib/taskboard/filterUtils';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import {
  buildProjectCalendarColorIndex,
  projectCalendarColorClassForId,
} from '../../lib/taskboard/calendarProjectColors';

function countTasksForProject(tasks: { project_id: string }[], projectId: ProjectFilter) {
  if (projectId === 'all') return tasks.length;
  return tasks.filter((task) => task.project_id === projectId).length;
}

export default function CalendarProjectFilterBar() {
  const {
    assigneeFilter,
    projectFilter,
    setProjectFilter,
    filterProjects,
    tasksForCounts,
  } = useTaskboardFilter();
  const { t } = useTaskboardI18n();

  useEffect(() => {
    if (projectFilter === 'all') return;
    if (!filterProjects.some((project) => project.id === projectFilter)) {
      setProjectFilter('all');
    }
  }, [filterProjects, projectFilter, setProjectFilter]);

  const tasksForProjectCounts = useMemo(
    () => filterTasksByAssignee(tasksForCounts, assigneeFilter),
    [tasksForCounts, assigneeFilter]
  );

  const orderedProjects = useMemo(
    () => sortProjectsByWorkload(filterProjects, tasksForCounts, assigneeFilter),
    [filterProjects, tasksForCounts, assigneeFilter]
  );

  const projectColorIndex = useMemo(
    () => buildProjectCalendarColorIndex(filterProjects),
    [filterProjects]
  );

  if (filterProjects.length === 0) return null;

  const allCount = tasksForProjectCounts.length;

  return (
    <div
      className="tb-header-scroll-row tb-header-scroll-row--filters"
      role="group"
      aria-label={t('calendar.filterByProject')}
    >
      <button
        type="button"
        onClick={() => setProjectFilter('all')}
        className={`tb-filter-btn relative ${projectFilter === 'all' ? 'tb-filter-btn--active' : ''}`}
      >
        {t('filter.all')}
        {allCount > 0 && (
          <span className="tb-filter-count" aria-label={`${allCount} task${allCount === 1 ? '' : 's'}`}>
            {allCount}
          </span>
        )}
      </button>
      {orderedProjects.map((project) => {
        const active = projectFilter === project.id;
        const count = countTasksForProject(tasksForProjectCounts, project.id);

        return (
          <button
            key={project.id}
            type="button"
            onClick={() => setProjectFilter(project.id)}
            className={`tb-filter-btn tb-filter-btn--project-color relative ${projectCalendarColorClassForId(project.id, projectColorIndex)}${
              active ? ' tb-filter-btn--active' : ''
            }`}
            title={project.name}
          >
            <span className="max-w-[12rem] truncate">{project.name}</span>
            {count > 0 && (
              <span className="tb-filter-count" aria-label={`${count} task${count === 1 ? '' : 's'}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
