import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { AssigneeFilter, ProjectFilter } from '../lib/taskboard/filterUtils';
import type { Project, Task } from '../lib/taskboard/types';

interface TaskboardFilterContextValue {
  assigneeFilter: AssigneeFilter;
  setAssigneeFilter: (filter: AssigneeFilter) => void;
  projectFilter: ProjectFilter;
  setProjectFilter: (filter: ProjectFilter) => void;
  filterProjects: Project[];
  setFilterProjects: (projects: Project[]) => void;
  tasksForCounts: Task[];
  setTasksForCounts: (tasks: Task[]) => void;
}

const TaskboardFilterContext = createContext<TaskboardFilterContextValue | null>(null);

export function TaskboardFilterProvider({ children }: { children: React.ReactNode }) {
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all');
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>('all');
  const [filterProjects, setFilterProjectsState] = useState<Project[]>([]);
  const [tasksForCounts, setTasksForCountsState] = useState<Task[]>([]);

  const setTasksForCounts = useCallback((tasks: Task[]) => {
    setTasksForCountsState(tasks);
  }, []);

  const setFilterProjects = useCallback((projects: Project[]) => {
    setFilterProjectsState(projects);
  }, []);

  const value = useMemo(
    () => ({
      assigneeFilter,
      setAssigneeFilter,
      projectFilter,
      setProjectFilter,
      filterProjects,
      setFilterProjects,
      tasksForCounts,
      setTasksForCounts,
    }),
    [
      assigneeFilter,
      projectFilter,
      filterProjects,
      tasksForCounts,
      setTasksForCounts,
      setFilterProjects,
    ]
  );

  return (
    <TaskboardFilterContext.Provider value={value}>{children}</TaskboardFilterContext.Provider>
  );
}

export function useTaskboardFilter() {
  const ctx = useContext(TaskboardFilterContext);
  if (!ctx) throw new Error('useTaskboardFilter must be used within TaskboardFilterProvider');
  return ctx;
}
