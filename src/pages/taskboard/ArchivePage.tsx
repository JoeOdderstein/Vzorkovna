import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTaskboardFilter } from '../../context/TaskboardFilterContext';
import { filterTasksByAssignee } from '../../lib/taskboard/filterUtils';
import type { Task } from '../../lib/taskboard/types';
import { fetchArchivedTasks, subscribeToArchive } from '../../lib/taskboard/taskService';
import { withRetry } from '../../lib/taskboard/loadUtils';
import { TASK_CATEGORIES } from '../../lib/taskboard/constants';
import { formatDeadline, getDeadlineStatus, deadlineClasses } from '../../lib/taskboard/deadlineUtils';
import { priorityLabels } from '../../lib/taskboard/priorityUtils';

export default function ArchivePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { assigneeFilter } = useTaskboardFilter();

  const filteredTasks = useMemo(
    () => filterTasksByAssignee(tasks, assigneeFilter),
    [tasks, assigneeFilter]
  );

  const load = useCallback(async () => {
    try {
      const data = await withRetry(() => fetchArchivedTasks(search));
      setTasks(data);
      setError('');
    } catch {
      setError('Could not load archive.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => subscribeToArchive(load), [load]);

  const categoryLabel = (id: string) =>
    TASK_CATEGORIES.find((c) => c.id === id)?.label ?? id;

  return (
    <div className="max-w-screen-lg mx-auto px-6 md:px-10">
      <Link
        to="/taskboard"
        className="inline-flex items-center gap-2 tb-link mb-8"
      >
        <ArrowLeft size={16} />
        Projects
      </Link>

      <span className="tb-label block mb-4">Archive</span>
      <h1 className="tb-heading-lg mb-8">Completed tasks</h1>

      <input
        type="search"
        placeholder="Search tasks…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md px-4 py-2.5 text-sm tb-search mb-8"
      />

      {loading && <p className="text-sm tb-muted">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && filteredTasks.length === 0 && (
        <p className="text-sm tb-muted">No completed tasks yet.</p>
      )}

      <ul className="space-y-3">
        {filteredTasks.map((task) => {
          const dl = getDeadlineStatus(task.deadline, true);
          return (
            <li key={task.id} className="tb-archive-card px-4 py-4">
              <p className="text-sm tb-text">
                {task.parent_task_id ? '↳ ' : ''}{task.task_name}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs tb-text-secondary">
                <span>{task.project?.name}</span>
                <span>{categoryLabel(task.category)}</span>
                <span>{priorityLabels[task.priority]}</span>
                {task.assigned_to && <span>{task.assigned_to}</span>}
                {task.deadline && (
                  <span className={deadlineClasses[dl]}>{formatDeadline(task.deadline)}</span>
                )}
                {task.completed_at && (
                  <span className="text-green-700">
                    Done {new Date(task.completed_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
