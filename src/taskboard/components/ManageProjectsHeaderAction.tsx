import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ManageProjectsDialog from './ManageProjectsDialog';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import { useTaskboardRefresh } from '../../context/TaskboardRefreshContext';
import type { Project } from '../../lib/taskboard/types';

export default function ManageProjectsHeaderAction() {
  const navigate = useNavigate();
  const { isAdmin } = useTaskboardAuth();
  const { refreshProjects, openProject } = useTaskboardRefresh();
  const [open, setOpen] = useState(false);

  if (!isAdmin) return null;

  const handleProjectCreated = (project: Project) => {
    openProject(project.id);
    navigate('/taskboard');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tb-btn-secondary shrink-0 whitespace-nowrap"
      >
        + Manage projects
      </button>
      <ManageProjectsDialog
        open={open}
        onClose={() => setOpen(false)}
        onChanged={refreshProjects}
        onProjectCreated={handleProjectCreated}
      />
    </>
  );
}
