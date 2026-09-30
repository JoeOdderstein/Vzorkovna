import { useState } from 'react';
import { Calendar } from 'lucide-react';
import AddTaskDialog from './AddTaskDialog';
import TaskCalendarDialog from './TaskCalendarDialog';
import TbIconTooltip from './TbIconTooltip';
import { useAddTaskFlow } from '../hooks/useAddTaskFlow';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';

export default function TaskboardHeaderActions() {
  const { addTaskOpen, setAddTaskOpen, handleCreateTask } = useAddTaskFlow();
  const { t } = useTaskboardI18n();
  const [calendarOpen, setCalendarOpen] = useState(false);

  return (
    <>
      <TbIconTooltip label={t('header.calendar')}>
        <button
          type="button"
          onClick={() => setCalendarOpen(true)}
          className="tb-btn-secondary px-2.5 shrink-0"
          aria-label={t('header.calendarAria')}
        >
          <Calendar size={18} />
        </button>
      </TbIconTooltip>
      <button
        type="button"
        onClick={() => setAddTaskOpen(true)}
        className="tb-btn-primary shrink-0 whitespace-nowrap"
      >
        {t('header.addTask')}
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
