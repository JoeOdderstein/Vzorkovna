import { useState } from 'react';
import { Calendar } from 'lucide-react';
import AddTaskDialog from './AddTaskDialog';
import TaskCalendarDialog from './TaskCalendarDialog';
import TbIconTooltip from './TbIconTooltip';
import { useAddTaskFlow } from '../hooks/useAddTaskFlow';

export default function TaskboardHeaderActions() {
  const { addTaskOpen, setAddTaskOpen, handleCreateTask } = useAddTaskFlow();
  const [calendarOpen, setCalendarOpen] = useState(false);

  return (
    <>
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
      <TaskCalendarDialog open={calendarOpen} onClose={() => setCalendarOpen(false)} />
      <AddTaskDialog
        open={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        onCreate={handleCreateTask}
      />
    </>
  );
}
