import { useMemo } from 'react';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import { useTaskboardFilter } from '../../context/TaskboardFilterContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { useAssigneeNames } from '../../hooks/useAssigneeNames';
import { defaultBoardNameForUsername } from '../../lib/taskboard/boardNameUtils';
import {
  buildAssigneeFilters,
  filterTasksByProject,
  orderAssigneeFiltersForUser,
  type AssigneeFilter,
} from '../../lib/taskboard/filterUtils';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { taskHasAssignee } from '../../lib/taskboard/assigneeUtils';
import type { Task } from '../../lib/taskboard/types';

function countTasksForFilter(tasks: Task[], id: AssigneeFilter) {
  if (id === 'all') return tasks.length;
  return tasks.filter((task) => taskHasAssignee(task, id)).length;
}

export default function AssigneeFilterBar() {
  const { username } = useTaskboardAuth();
  const { profile } = useUserProfile();
  const { assigneeFilter, setAssigneeFilter, tasksForCounts, projectFilter } = useTaskboardFilter();
  const assigneeNames = useAssigneeNames();
  const { t } = useTaskboardI18n();

  const tasksForAssigneeCounts = useMemo(
    () => filterTasksByProject(tasksForCounts, projectFilter),
    [tasksForCounts, projectFilter]
  );

  const counts = useMemo(() => {
    const map: Record<AssigneeFilter, number> = { all: 0 } as Record<AssigneeFilter, number>;
    for (const { id } of buildAssigneeFilters(assigneeNames)) {
      map[id] = countTasksForFilter(tasksForAssigneeCounts, id);
    }
    return map;
  }, [tasksForAssigneeCounts, assigneeNames]);

  const currentAssignee =
    profile?.board_name ?? (username ? defaultBoardNameForUsername(username) : null);

  const orderedFilters = useMemo(
    () => orderAssigneeFiltersForUser(currentAssignee, counts, assigneeNames),
    [currentAssignee, counts, assigneeNames]
  );

  return (
    <div className="tb-header-scroll-row tb-header-scroll-row--filters">
      {orderedFilters.map(({ id, label }) => {
        const active = assigneeFilter === id;
        const count = counts[id] ?? 0;

        return (
          <button
            key={id}
            type="button"
            onClick={() => setAssigneeFilter(id)}
            className={`tb-filter-btn relative ${active ? 'tb-filter-btn--active' : ''}`}
          >
            {id === 'all' ? t('filter.all') : label}
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
