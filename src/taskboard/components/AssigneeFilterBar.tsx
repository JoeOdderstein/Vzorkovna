import { useMemo } from 'react';
import { useTaskboardFilter } from '../../context/TaskboardFilterContext';
import { ASSIGNEE_FILTERS } from '../../lib/taskboard/filterUtils';
import { taskHasAssignee } from '../../lib/taskboard/assigneeUtils';
import type { Task } from '../../lib/taskboard/types';
import type { AssigneeFilter } from '../../lib/taskboard/filterUtils';

function countTasksForFilter(tasks: Task[], id: AssigneeFilter) {
  if (id === 'all') return tasks.length;
  return tasks.filter((task) => taskHasAssignee(task, id)).length;
}

export default function AssigneeFilterBar() {
  const { assigneeFilter, setAssigneeFilter, tasksForCounts } = useTaskboardFilter();

  const counts = useMemo(() => {
    const map: Record<AssigneeFilter, number> = { all: 0 } as Record<AssigneeFilter, number>;
    for (const { id } of ASSIGNEE_FILTERS) {
      map[id] = countTasksForFilter(tasksForCounts, id);
    }
    return map;
  }, [tasksForCounts]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {ASSIGNEE_FILTERS.map(({ id, label }) => {
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
