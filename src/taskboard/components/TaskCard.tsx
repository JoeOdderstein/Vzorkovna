import type { Task } from '../../lib/taskboard/types';
import { formatAssignees } from '../../lib/taskboard/assigneeUtils';
import { deadlineClasses, formatDeadline, getDeadlineStatus } from '../../lib/taskboard/deadlineUtils';
import { priorityBorderClasses, priorityDotClasses, priorityLabels } from '../../lib/taskboard/priorityUtils';

interface TaskCardProps {
  task: Task;
  isSubtask?: boolean;
  onClick: () => void;
  onComplete?: (taskId: string) => void;
  expandControl?: {
    collapsed: boolean;
    onToggle: () => void;
  };
}

export default function TaskCard({
  task,
  isSubtask = false,
  onClick,
  onComplete,
  expandControl,
}: TaskCardProps) {
  const deadlineStatus = getDeadlineStatus(task.deadline, task.completed);

  return (
    <div
      className={`w-full tb-card border-l-2 ${priorityBorderClasses[task.priority]} px-3 py-3`}
    >
      <div className="flex items-start gap-2">
        {expandControl && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              expandControl.onToggle();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-xs text-[#80868b] hover:text-[#5f6368] w-4 shrink-0 mt-0.5"
            aria-label={expandControl.collapsed ? 'Expand subtasks' : 'Collapse subtasks'}
          >
            {expandControl.collapsed ? '▶' : '▼'}
          </button>
        )}
        {isSubtask && (
          <span className="text-xs tb-muted mt-0.5 shrink-0">↳</span>
        )}
        <button
          type="button"
          onClick={onClick}
          className="min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
        >
          <p className={`text-sm leading-snug ${isSubtask ? 'tb-text-secondary' : 'tb-text'}`}>
            {task.task_name || 'Untitled task'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${priorityDotClasses[task.priority]}`} />
              <span className="text-xs tb-text-secondary">
                {priorityLabels[task.priority]}
              </span>
            </span>
            {task.deadline && (
              <span className={`text-xs ${deadlineClasses[deadlineStatus]}`}>
                {formatDeadline(task.deadline)}
              </span>
            )}
            {task.assignees.length > 0 && (
              <span className="text-xs tb-text-secondary">{formatAssignees(task.assignees)}</span>
            )}
          </div>
        </button>
        {onComplete && (
          <input
            type="checkbox"
            checked={false}
            onChange={() => onComplete(task.id)}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="tb-task-checkbox shrink-0"
            aria-label={`Mark "${task.task_name || 'Untitled task'}" as complete`}
          />
        )}
      </div>
    </div>
  );
}
