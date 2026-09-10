import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import { useTaskboardRefresh } from '../../context/TaskboardRefreshContext';
import type { TaskCategory } from '../../lib/taskboard/constants';
import { createTask, fetchVisibleProjects } from '../../lib/taskboard/taskService';

export function useAddTaskFlow() {
  const navigate = useNavigate();
  const { username, isAdmin } = useTaskboardAuth();
  const { openProject } = useTaskboardRefresh();
  const [addTaskOpen, setAddTaskOpen] = useState(false);

  const handleCreateTask = useCallback(
    async ({ category, projectId }: { category: TaskCategory; projectId: string }) => {
      const task = await createTask({ project_id: projectId, category });
      const projects = await fetchVisibleProjects(username, isAdmin);
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        openProject(project.id);
        navigate(`/taskboard?open=${project.slug}&task=${task.id}`);
      } else {
        window.location.reload();
      }
    },
    [navigate, openProject, username, isAdmin]
  );

  return {
    addTaskOpen,
    setAddTaskOpen,
    handleCreateTask,
  };
}
