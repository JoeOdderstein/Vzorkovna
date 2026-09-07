import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTaskboardFilter } from '../../context/TaskboardFilterContext';
import { useTaskboardRefresh } from '../../context/TaskboardRefreshContext';
import { countProjectTasksForFilter, sortProjectsByWorkload } from '../../lib/taskboard/filterUtils';
import { withRetry } from '../../lib/taskboard/loadUtils';
import {
  fetchAllActiveTasks,
  fetchProjects,
} from '../../lib/taskboard/taskService';
import type { Project, Task } from '../../lib/taskboard/types';
import ProjectBoardPanel from '../../taskboard/components/ProjectBoardPanel';

export default function TaskboardOverviewPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { assigneeFilter } = useTaskboardFilter();
  const { projectsToken, expandProjectId } = useTaskboardRefresh();
  const [searchParams] = useSearchParams();

  const refreshAllTasks = useCallback(() => {
    fetchAllActiveTasks()
      .then(setAllTasks)
      .catch(() => {});
  }, []);

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
  }, [projectsToken]);

  useEffect(() => {
    if (!expandProjectId) return;
    setExpanded((prev) => ({ ...prev, [expandProjectId]: true }));
  }, [expandProjectId]);

  const openSlug = searchParams.get('open');
  const openTaskId = searchParams.get('task');

  useEffect(() => {
    if (!openSlug || projects.length === 0) return;
    const project = projects.find((p) => p.slug === openSlug);
    if (!project) return;
    setExpanded((prev) => ({ ...prev, [project.id]: true }));
  }, [openSlug, projects]);

  const sortedProjects = useMemo(
    () => sortProjectsByWorkload(projects, allTasks, assigneeFilter),
    [projects, allTasks, assigneeFilter]
  );

  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const project of projects) {
      counts[project.id] = countProjectTasksForFilter(allTasks, project.id, assigneeFilter);
    }
    return counts;
  }, [projects, allTasks, assigneeFilter]);

  const toggleProject = (projectId: string) => {
    setExpanded((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const initialTaskForProject = (project: Project) => {
    if (openSlug !== project.slug || !openTaskId) return null;
    return openTaskId;
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-6 md:px-10">
      <span className="tb-label block mb-4">Projects</span>
      <p className="text-sm tb-muted mb-6">
        Click a project to expand its tasks. You can open multiple projects at once.
      </p>

      {loading && <p className="text-sm tb-muted">Loading projects…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <ul className="divide-y divide-[#dadce0] border-y border-[#dadce0]">
          {sortedProjects.map((project) => {
            const count = taskCounts[project.id] ?? 0;
            const isOpen = Boolean(expanded[project.id]);

            return (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => toggleProject(project.id)}
                  className="group w-full flex items-center gap-4 py-4 text-left transition-colors hover:bg-[#f8f9fa]"
                  aria-expanded={isOpen}
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
                  {isOpen ? (
                    <ChevronDown size={18} className="text-[#80868b] shrink-0" />
                  ) : (
                    <ChevronRight size={18} className="text-[#80868b] shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="pl-2 sm:pl-14 pr-2 border-t border-[#e8eaed] bg-[#fafafa]">
                    <ProjectBoardPanel
                      project={project}
                      initialTaskId={initialTaskForProject(project)}
                      onTasksChange={refreshAllTasks}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
