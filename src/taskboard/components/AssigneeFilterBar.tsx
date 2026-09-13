import { useMemo } from 'react';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import { useTaskboardFilter } from '../../context/TaskboardFilterContext';
import { defaultBoardNameForUsername } from '../../lib/taskboard/boardNameUtils';
import {
  ASSIGNEE_FILTERS,
  orderAssigneeFiltersForUser,
  type AssigneeFilter,
} from '../../lib/taskboard/filterUtils';
import { taskHasAssignee } from '../../lib/taskboard/assigneeUtils';
import type { Task } from '../../lib/taskboard/types';

function countTasksForFilter(tasks: Task[], id: AssigneeFilter) {
  if (id === 'all') return tasks.length;
  return tasks.filter((task) => taskHasAssignee(task, id)).length;
}

export default function AssigneeFilterBar() {
  const { username } = useTaskboardAuth();
  const { assigneeFilter, setAssigneeFilter, tasksForCounts } = useTaskboardFilter();

  const counts = useMemo(() => {
    const map: Record<AssigneeFilter, number> = { all: 0 } as Record<AssigneeFilter, number>;
    for (const { id } of ASSIGNEE_FILTERS) {
      map[id] = countTasksForFilter(tasksForCounts, id);
    }
    return map;
  }, [tasksForCounts]);

  const currentAssignee = username ? defaultBoardNameForUsername(username) : null;

  const orderedFilters = useMemo(
    () => orderAssigneeFiltersForUser(currentAssignee, counts),
    [currentAssignee, counts]
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
            {label}
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
