import { useCallback, useEffect, useState } from 'react';
import { useCompleteUndo } from '../../context/CompleteUndoContext';
import { useTaskboardSelection } from '../../context/TaskboardSelectionContext';
import type { TaskCategory } from '../../lib/taskboard/constants';
import type { Task } from '../../lib/taskboard/types';
import {
  createTask,
  fetchActiveTasks,
  updateTask,
} from '../../lib/taskboard/taskService';
import { withRetry } from '../../lib/taskboard/loadUtils';
import TaskDrawer from './TaskDrawer';

export default function TaskDrawerHost() {
  const { selected, taskSnapshot, taskChangeToken, openTask, closeTask, notifyTaskChange } =
    useTaskboardSelection();
  const { showCompleteUndo, dismissCompleteUndo } = useCompleteUndo();
  const [task, setTask] = useState<Task | null>(null);

  useEffect(() => {
    if (!selected) {
      setTask(null);
      return;
    }

    if (taskSnapshot?.id === selected.taskId) {
      setTask(taskSnapshot);
    }

    let cancelled = false;

    withRetry(() => fetchActiveTasks(selected.projectId))
      .then((tasks) => {
        if (cancelled) return;
        const match = tasks.find((t) => t.id === selected.taskId);
        if (match) {
          setTask(match);
        } else {
          closeTask();
        }
      })
      .catch(() => {
        if (!cancelled && taskSnapshot?.id === selected.taskId) {
          setTask(taskSnapshot);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selected, taskSnapshot, taskChangeToken, closeTask]);

  const handleSaved = useCallback(() => {
    notifyTaskChange();
  }, [notifyTaskChange]);

  const handleCategoryChange = useCallback(
    async (taskId: string, category: TaskCategory) => {
      if (!selected) return;
      const tasks = await fetchActiveTasks(selected.projectId);
      await updateTask(taskId, { category });
      const subtasks = tasks.filter((t) => t.parent_task_id === taskId);
      await Promise.all(subtasks.map((sub) => updateTask(sub.id, { category })));
      notifyTaskChange();
    },
    [selected, notifyTaskChange]
  );

  const handleAddSubtask = useCallback(
    async (parentId: string) => {
      if (!selected) return;
      const tasks = await fetchActiveTasks(selected.projectId);
      const parent = tasks.find((t) => t.id === parentId);
      if (!parent) return;

      const sub = await createTask({
        project_id: selected.projectId,
        category: parent.category,
        parent_task_id: parentId,
        assignees: [...parent.assignees],
        priority: parent.priority,
        deadline: parent.deadline,
      });
      openTask(sub, selected.projectId);
      notifyTaskChange();
    },
    [selected, openTask, notifyTaskChange]
  );

  const handleCompleteTask = useCallback(
    async (taskId: string) => {
      if (!selected) return;

      let taskName = 'Untitled task';
      try {
        const tasks = await fetchActiveTasks(selected.projectId);
        const completed = tasks.find((t) => t.id === taskId);
        if (completed) taskName = completed.task_name || taskName;

        closeTask();

        showCompleteUndo({
          taskName,
          onUndo: async () => {
            await updateTask(taskId, { completed: false });
            notifyTaskChange();
          },
        });

        await updateTask(taskId, { completed: true });
        notifyTaskChange();
      } catch {
        dismissCompleteUndo();
      }
    },
    [selected, closeTask, showCompleteUndo, dismissCompleteUndo, notifyTaskChange]
  );

  if (!selected || !task) return null;

  return (
    <TaskDrawer
      task={task}
      projectId={selected.projectId}
      category={task.category}
      onClose={closeTask}
      onSaved={handleSaved}
      onAddSubtask={handleAddSubtask}
      onCategoryChange={handleCategoryChange}
      onComplete={handleCompleteTask}
    />
  );
}
