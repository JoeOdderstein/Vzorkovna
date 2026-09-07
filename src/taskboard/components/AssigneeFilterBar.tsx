import { ASSIGNEE_FILTERS } from '../../lib/taskboard/filterUtils';
import { useTaskboardFilter } from '../../context/TaskboardFilterContext';

export default function AssigneeFilterBar() {
  const { assigneeFilter, setAssigneeFilter } = useTaskboardFilter();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {ASSIGNEE_FILTERS.map(({ id, label }) => {
        const active = assigneeFilter === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setAssigneeFilter(id)}
            className={`tb-filter-btn ${active ? 'tb-filter-btn--active' : ''}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
