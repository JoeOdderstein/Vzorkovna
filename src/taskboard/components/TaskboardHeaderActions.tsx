import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AddTaskDialog from './AddTaskDialog';
import ManageProjectsDialog from './ManageProjectsDialog';
import TaskCalendarDialog from './TaskCalendarDialog';
import TbIconTooltip from './TbIconTooltip';
import { useAddTaskFlow } from '../hooks/useAddTaskFlow';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import { useTaskboardRefresh } from '../../context/TaskboardRefreshContext';
import type { Project } from '../../lib/taskboard/types';

export default function TaskboardHeaderActions() {
  const navigate = useNavigate();
  const { isAdmin } = useTaskboardAuth();
  const { refreshProjects, openProject } = useTaskboardRefresh();
  const { addTaskOpen, setAddTaskOpen, handleCreateTask } = useAddTaskFlow();
  const [manageProjectsOpen, setManageProjectsOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handleProjectsChanged = () => {
    refreshProjects();
  };

  const handleProjectCreated = (project: Project) => {
    openProject(project.id);
    navigate('/taskboard');
  };

  return (
    <>
      {isAdmin && (
        <button
          type="button"
          onClick={() => setManageProjectsOpen(true)}
          className="tb-btn-secondary shrink-0 whitespace-nowrap"
        >
          + Manage projects
        </button>
      )}
      <TbIconTooltip label="Calendar">
        <button
          type="button"
          onClick={() => setCalendarOpen(true)}
          className="tb-btn-secondary px-2.5 shrink-0"
          aria-label="View deadlines calendar"
        >
          <Calendar size={18} />
        </button>
      </TbIconTooltip>
      <button
        type="button"
        onClick={() => setAddTaskOpen(true)}
        className="tb-btn-primary shrink-0 whitespace-nowrap"
      >
        + Add task
      </button>
      <ManageProjectsDialog
        open={manageProjectsOpen}
        onClose={() => setManageProjectsOpen(false)}
        onChanged={handleProjectsChanged}
        onProjectCreated={handleProjectCreated}
      />
      <TaskCalendarDialog open={calendarOpen} onClose={() => setCalendarOpen(false)} />
      <AddTaskDialog
        open={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        onCreate={handleCreateTask}
      />
    </>
  );
}
