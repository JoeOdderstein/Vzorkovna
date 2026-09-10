import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Undo2 } from 'lucide-react';
import { useTaskboardFilter } from '../../context/TaskboardFilterContext';
import { formatAssignees } from '../../lib/taskboard/assigneeUtils';
import { filterTasksByAssignee } from '../../lib/taskboard/filterUtils';
import type { Task } from '../../lib/taskboard/types';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import {
  fetchArchivedTasks,
  fetchVisibleProjects,
  filterTasksForProjects,
  subscribeToArchive,
  updateTask,
} from '../../lib/taskboard/taskService';
import { withRetry } from '../../lib/taskboard/loadUtils';
import { getCategoryLabel } from '../../lib/taskboard/categoryUtils';
import { fetchCategoriesForProject } from '../../lib/taskboard/categoryService';
import type { CategoryOption } from '../../lib/taskboard/types';
import { formatDeadline, getDeadlineStatus, deadlineClasses } from '../../lib/taskboard/deadlineUtils';
import { priorityLabels } from '../../lib/taskboard/priorityUtils';

export default function ArchivePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [categoryLabelsByProject, setCategoryLabelsByProject] = useState<
    Record<string, CategoryOption[]>
  >({});
  const { username, isAdmin } = useTaskboardAuth();
  const { assigneeFilter, setTasksForCounts } = useTaskboardFilter();

  const filteredTasks = useMemo(
    () => filterTasksByAssignee(tasks, assigneeFilter),
    [tasks, assigneeFilter]
  );

  const load = useCallback(async () => {
    try {
      const data = await withRetry(async () => {
        const [visibleProjects, archivedTasks] = await Promise.all([
          fetchVisibleProjects(username, isAdmin),
          fetchArchivedTasks(search),
        ]);
        const filtered = filterTasksForProjects(archivedTasks, visibleProjects);
        const labels = Object.fromEntries(
          await Promise.all(
            visibleProjects.map(async (project) => [
              project.id,
              await fetchCategoriesForProject(project.id),
            ])
          )
        );
        setCategoryLabelsByProject(labels);
        return filtered;
      });
      setTasks(data);
      setError('');
    } catch {
      setError('Could not load archive.');
    } finally {
      setLoading(false);
    }
  }, [search, username, isAdmin]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => subscribeToArchive(load), [load]);

  useEffect(() => {
    setTasksForCounts(tasks);
  }, [tasks, setTasksForCounts]);

  const handleRestore = async (taskId: string) => {
    setRestoringId(taskId);
    setError('');
    try {
      await updateTask(taskId, { completed: false });
      await load();
    } catch {
      setError('Could not restore task.');
    } finally {
      setRestoringId(null);
    }
  };

  const categoryLabel = (projectId: string, id: string) =>
    getCategoryLabel(id, categoryLabelsByProject[projectId]);

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
            <li key={task.id} className="tb-archive-card px-4 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm tb-text">
                  {task.parent_task_id ? '↳ ' : ''}{task.task_name}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs tb-text-secondary">
                  <span>{task.project?.name}</span>
                  <span>{categoryLabel(task.project_id, task.category)}</span>
                  <span>{priorityLabels[task.priority]}</span>
                  {task.assignees.length > 0 && <span>{formatAssignees(task.assignees)}</span>}
                  {task.deadline && (
                    <span className={deadlineClasses[dl]}>{formatDeadline(task.deadline)}</span>
                  )}
                  {task.completed_at && (
                    <span className="text-green-700">
                      Done {new Date(task.completed_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRestore(task.id)}
                disabled={restoringId === task.id}
                className="inline-flex items-center gap-1.5 tb-link text-sm shrink-0 disabled:opacity-50"
              >
                <Undo2 size={14} />
                {restoringId === task.id ? 'Restoring…' : 'Undo'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
