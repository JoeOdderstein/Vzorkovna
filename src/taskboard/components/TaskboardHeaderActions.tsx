import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AddTaskDialog from './AddTaskDialog';
import ManageProjectsDialog from './ManageProjectsDialog';
import { useTaskboardRefresh } from '../../context/TaskboardRefreshContext';
import { createTask, fetchProjects } from '../../lib/taskboard/taskService';
import type { TaskCategory } from '../../lib/taskboard/constants';
import type { Project } from '../../lib/taskboard/types';

export default function TaskboardHeaderActions() {
  const navigate = useNavigate();
  const { refreshProjects, openProject } = useTaskboardRefresh();
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [manageProjectsOpen, setManageProjectsOpen] = useState(false);

  const handleCreateTask = async ({
    category,
    projectId,
  }: {
    category: TaskCategory;
    projectId: string;
  }) => {
    const task = await createTask({ project_id: projectId, category });
    const projects = await fetchProjects();
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      navigate(`/taskboard?open=${project.slug}&task=${task.id}`);
    } else {
      window.location.reload();
    }
  };

  const handleProjectsChanged = () => {
    refreshProjects();
  };

  const handleProjectCreated = (project: Project) => {
    openProject(project.id);
    navigate('/taskboard');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setManageProjectsOpen(true)}
        className="tb-btn-secondary"
      >
        + Manage projects
      </button>
      <button type="button" onClick={() => setAddTaskOpen(true)} className="tb-btn-primary">
        + Add task
      </button>
      <ManageProjectsDialog
        open={manageProjectsOpen}
        onClose={() => setManageProjectsOpen(false)}
        onChanged={handleProjectsChanged}
        onProjectCreated={handleProjectCreated}
      />
      <AddTaskDialog
        open={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        onCreate={handleCreateTask}
      />
    </>
  );
}
