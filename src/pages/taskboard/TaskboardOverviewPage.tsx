import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useTaskboardFilter } from '../../context/TaskboardFilterContext';
import { countProjectTasksForFilter } from '../../lib/taskboard/filterUtils';
import { withRetry } from '../../lib/taskboard/loadUtils';
import {
  fetchAllActiveTasks,
  fetchProjects,
} from '../../lib/taskboard/taskService';
import type { Project, Task } from '../../lib/taskboard/types';

export default function TaskboardOverviewPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { assigneeFilter } = useTaskboardFilter();

  useEffect(() => {
    let cancelled = false;

    withRetry(() => Promise.all([fetchProjects(), fetchAllActiveTasks()]))
      .then(([projectList, tasks]) => {
        if (cancelled) return;
        setProjects(projectList);
        setAllTasks(tasks);
        setError('');
      })
      .catch(() => {
        if (cancelled) return;
        setError('Could not load projects. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const project of projects) {
      counts[project.id] = countProjectTasksForFilter(allTasks, project.id, assigneeFilter);
    }
    return counts;
  }, [projects, allTasks, assigneeFilter]);

  return (
    <div className="max-w-screen-md mx-auto px-6 md:px-10">
      <span className="tb-label block mb-4">Projects</span>

      {loading && <p className="text-sm tb-muted">Loading projects…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <ul>
          {projects.map((project) => {
            const count = taskCounts[project.id] ?? 0;
            return (
              <li key={project.id}>
                <Link
                  to={`/taskboard/projects/${project.slug}`}
                  className="group flex items-center gap-4 py-4 tb-list-item transition-colors"
                >
                  <span
                    className={`tb-count-badge ${count === 0 ? 'tb-count-badge--empty' : ''}`}
                    aria-label={`${count} active task${count === 1 ? '' : 's'}`}
                  >
                    {count}
                  </span>
                  <span className="flex-1 text-base tb-text group-hover:opacity-80 transition-opacity">
                    {project.name}
                  </span>
                  <ChevronRight
                    size={18}
                    className="text-[#80868b] group-hover:text-[#5f6368] transition-colors shrink-0"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
