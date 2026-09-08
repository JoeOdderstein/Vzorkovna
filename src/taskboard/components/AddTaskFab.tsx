import { Plus } from 'lucide-react';
import AddTaskDialog from './AddTaskDialog';
import { useAddTaskFlow } from '../hooks/useAddTaskFlow';

export default function AddTaskFab() {
  const { addTaskOpen, setAddTaskOpen, handleCreateTask } = useAddTaskFlow();

  return (
    <>
      <button
        type="button"
        onClick={() => setAddTaskOpen(true)}
        className="taskboard tb-fab"
        aria-label="Create new task"
      >
        <Plus size={22} strokeWidth={2.5} />
      </button>
      <AddTaskDialog
        open={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        onCreate={handleCreateTask}
      />
    </>
  );
}
