import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Task } from '../lib/taskboard/types';

interface TaskSelection {
  taskId: string;
  projectId: string;
}

interface TaskboardSelectionContextValue {
  selected: TaskSelection | null;
  taskSnapshot: Task | null;
  taskChangeToken: number;
  openTask: (task: Task, projectId: string) => void;
  closeTask: () => void;
  notifyTaskChange: () => void;
}

const TaskboardSelectionContext = createContext<TaskboardSelectionContextValue | null>(null);

export function TaskboardSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<TaskSelection | null>(null);
  const [taskSnapshot, setTaskSnapshot] = useState<Task | null>(null);
  const [taskChangeToken, setTaskChangeToken] = useState(0);

  const openTask = useCallback((task: Task, projectId: string) => {
    setSelected({ taskId: task.id, projectId });
    setTaskSnapshot(task);
  }, []);

  const closeTask = useCallback(() => {
    setSelected(null);
    setTaskSnapshot(null);
  }, []);

  const notifyTaskChange = useCallback(() => {
    setTaskChangeToken((n) => n + 1);
  }, []);

  const value = useMemo(
    () => ({
      selected,
      taskSnapshot,
      taskChangeToken,
      openTask,
      closeTask,
      notifyTaskChange,
    }),
    [selected, taskSnapshot, taskChangeToken, openTask, closeTask, notifyTaskChange]
  );

  return (
    <TaskboardSelectionContext.Provider value={value}>{children}</TaskboardSelectionContext.Provider>
  );
}

export function useTaskboardSelection() {
  const ctx = useContext(TaskboardSelectionContext);
  if (!ctx) {
    throw new Error('useTaskboardSelection must be used within TaskboardSelectionProvider');
  }
  return ctx;
}
