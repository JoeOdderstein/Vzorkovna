import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import { useTaskboardRefresh } from '../../context/TaskboardRefreshContext';
import type { TaskCategory } from '../../lib/taskboard/constants';
import { createTask, fetchVisibleProjects } from '../../lib/taskboard/taskService';
import type { Task } from '../../lib/taskboard/types';

export type AddTaskFlowOptions = {
  /** Keep the user on the current page (e.g. calendar) instead of opening the taskboard. */
  onCreated?: (task: Task) => void;
};

export function useAddTaskFlow(options?: AddTaskFlowOptions) {
  const navigate = useNavigate();
  const { username, isAdmin } = useTaskboardAuth();
  const { openProject, refreshProjects } = useTaskboardRefresh();
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const onCreatedRef = useRef(options?.onCreated);
  onCreatedRef.current = options?.onCreated;

  const handleCreateTask = useCallback(
    async ({ category, projectId }: { category: TaskCategory; projectId: string }) => {
      const task = await createTask({ project_id: projectId, category });
      if (onCreatedRef.current) {
        refreshProjects();
        onCreatedRef.current(task);
        return;
      }
      const projects = await fetchVisibleProjects(username, isAdmin);
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        openProject(project.id);
        navigate(`/taskboard?open=${project.slug}&task=${task.id}`);
      } else {
        window.location.reload();
      }
    },
    [navigate, openProject, refreshProjects, username, isAdmin]
  );

  return {
    addTaskOpen,
    setAddTaskOpen,
    handleCreateTask,
  };
}
