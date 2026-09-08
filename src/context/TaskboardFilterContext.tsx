import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { AssigneeFilter } from '../lib/taskboard/filterUtils';
import type { Task } from '../lib/taskboard/types';

interface TaskboardFilterContextValue {
  assigneeFilter: AssigneeFilter;
  setAssigneeFilter: (filter: AssigneeFilter) => void;
  tasksForCounts: Task[];
  setTasksForCounts: (tasks: Task[]) => void;
}

const TaskboardFilterContext = createContext<TaskboardFilterContextValue | null>(null);

export function TaskboardFilterProvider({ children }: { children: React.ReactNode }) {
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all');
  const [tasksForCounts, setTasksForCountsState] = useState<Task[]>([]);

  const setTasksForCounts = useCallback((tasks: Task[]) => {
    setTasksForCountsState(tasks);
  }, []);

  const value = useMemo(
    () => ({ assigneeFilter, setAssigneeFilter, tasksForCounts, setTasksForCounts }),
    [assigneeFilter, tasksForCounts, setTasksForCounts]
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
