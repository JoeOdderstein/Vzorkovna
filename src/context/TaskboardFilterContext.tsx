import { createContext, useContext, useMemo, useState } from 'react';
import type { AssigneeFilter } from '../lib/taskboard/filterUtils';

interface TaskboardFilterContextValue {
  assigneeFilter: AssigneeFilter;
  setAssigneeFilter: (filter: AssigneeFilter) => void;
}

const TaskboardFilterContext = createContext<TaskboardFilterContextValue | null>(null);

export function TaskboardFilterProvider({ children }: { children: React.ReactNode }) {
  const [assigneeFilter, setAssigneeFilter] = useState<AssigneeFilter>('all');

  const value = useMemo(
    () => ({ assigneeFilter, setAssigneeFilter }),
    [assigneeFilter]
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
