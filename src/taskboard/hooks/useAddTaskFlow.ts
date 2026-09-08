import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTaskboardRefresh } from '../../context/TaskboardRefreshContext';
import type { TaskCategory } from '../../lib/taskboard/constants';
import { createTask, fetchProjects } from '../../lib/taskboard/taskService';

export function useAddTaskFlow() {
  const navigate = useNavigate();
  const { openProject } = useTaskboardRefresh();
  const [addTaskOpen, setAddTaskOpen] = useState(false);

  const handleCreateTask = useCallback(
    async ({ category, projectId }: { category: TaskCategory; projectId: string }) => {
      const task = await createTask({ project_id: projectId, category });
      const projects = await fetchProjects();
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        openProject(project.id);
        navigate(`/taskboard?open=${project.slug}&task=${task.id}`);
      } else {
        window.location.reload();
      }
    },
    [navigate, openProject]
  );

  return {
    addTaskOpen,
    setAddTaskOpen,
    handleCreateTask,
  };
}
