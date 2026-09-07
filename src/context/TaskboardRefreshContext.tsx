import { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface TaskboardRefreshContextValue {
  projectsToken: number;
  refreshProjects: () => void;
  expandProjectId: string | null;
  openProject: (projectId: string) => void;
}

const TaskboardRefreshContext = createContext<TaskboardRefreshContextValue | null>(null);

export function TaskboardRefreshProvider({ children }: { children: React.ReactNode }) {
  const [projectsToken, setProjectsToken] = useState(0);
  const [expandProjectId, setExpandProjectId] = useState<string | null>(null);

  const refreshProjects = useCallback(() => {
    setProjectsToken((n) => n + 1);
  }, []);

  const openProject = useCallback((projectId: string) => {
    setExpandProjectId(projectId);
  }, []);

  const value = useMemo(
    () => ({ projectsToken, refreshProjects, expandProjectId, openProject }),
    [projectsToken, refreshProjects, expandProjectId, openProject]
  );

  return (
    <TaskboardRefreshContext.Provider value={value}>{children}</TaskboardRefreshContext.Provider>
  );
}

export function useTaskboardRefresh() {
  const ctx = useContext(TaskboardRefreshContext);
  if (!ctx) throw new Error('useTaskboardRefresh must be used within TaskboardRefreshProvider');
  return ctx;
}
