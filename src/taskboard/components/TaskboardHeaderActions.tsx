import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AddTaskDialog from './AddTaskDialog';
import ManageProjectsDialog from './ManageProjectsDialog';
import { useAddTaskFlow } from '../hooks/useAddTaskFlow';
import { useTaskboardRefresh } from '../../context/TaskboardRefreshContext';
import type { Project } from '../../lib/taskboard/types';

export default function TaskboardHeaderActions() {
  const navigate = useNavigate();
  const { refreshProjects, openProject } = useTaskboardRefresh();
  const { addTaskOpen, setAddTaskOpen, handleCreateTask } = useAddTaskFlow();
  const [manageProjectsOpen, setManageProjectsOpen] = useState(false);

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
