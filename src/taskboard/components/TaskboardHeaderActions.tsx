import AddTaskDialog from './AddTaskDialog';
import { useAddTaskFlow } from '../hooks/useAddTaskFlow';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';

export default function TaskboardHeaderActions() {
  const { addTaskOpen, setAddTaskOpen, handleCreateTask } = useAddTaskFlow();
  const { t } = useTaskboardI18n();

  return (
    <>
      <button
        type="button"
        onClick={() => setAddTaskOpen(true)}
        className="tb-btn-primary shrink-0 whitespace-nowrap"
      >
        {t('header.addTask')}
      </button>
      <AddTaskDialog
        open={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        onCreate={handleCreateTask}
      />
    </>
  );
}
