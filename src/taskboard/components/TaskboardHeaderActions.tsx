import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AddTaskDialog from './AddTaskDialog';
import { createTask, fetchProjects } from '../../lib/taskboard/taskService';
import type { TaskCategory } from '../../lib/taskboard/constants';

export default function TaskboardHeaderActions() {
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);

  const handleCreate = async ({
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
      navigate(`/taskboard/projects/${project.slug}?task=${task.id}`);
    } else {
      window.location.reload();
    }
  };

  return (
    <>
      <button type="button" onClick={() => setAddOpen(true)} className="tb-btn-primary">
        + Add task
      </button>
      <AddTaskDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={handleCreate}
      />
    </>
  );
}
