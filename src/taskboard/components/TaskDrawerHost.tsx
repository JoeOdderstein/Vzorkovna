import { useCallback, useEffect, useState } from 'react';
import { useCompleteUndo } from '../../context/CompleteUndoContext';
import { useTaskboardSelection } from '../../context/TaskboardSelectionContext';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import type { TaskCategory } from '../../lib/taskboard/constants';
import type { CategoryOption, Task } from '../../lib/taskboard/types';
import {
  createProjectCategory,
  deleteProjectCategory,
  fetchCategoriesForProject,
  refreshCategoriesForProject,
} from '../../lib/taskboard/categoryService';
import { DEFAULT_CATEGORIES } from '../../lib/taskboard/categoryUtils';
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
  const { isAdmin } = useTaskboardAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>(DEFAULT_CATEGORIES);

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

  useEffect(() => {
    if (!selected) {
      setCategories(DEFAULT_CATEGORIES);
      return;
    }

    fetchCategoriesForProject(selected.projectId)
      .then(setCategories)
      .catch(() => setCategories(DEFAULT_CATEGORIES));
  }, [selected, taskChangeToken]);

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

  const handleAddCategory = useCallback(
    async (label: string) => {
      if (!selected) return;
      const created = await createProjectCategory(selected.projectId, label);
      const next = await refreshCategoriesForProject(selected.projectId, created);
      setCategories(next);
      return created.slug;
    },
    [selected]
  );

  const handleRemoveCategory = useCallback(
    async (categoryId: string) => {
      if (!selected) return;
      await deleteProjectCategory(selected.projectId, categoryId);
      const next = await fetchCategoriesForProject(selected.projectId);
      setCategories(next);
      notifyTaskChange();
    },
    [selected, notifyTaskChange]
  );

  if (!selected || !task) return null;

  return (
    <TaskDrawer
      task={task}
      projectId={selected.projectId}
      category={task.category}
      categories={categories}
      onClose={closeTask}
      onSaved={handleSaved}
      onAddSubtask={handleAddSubtask}
      onCategoryChange={handleCategoryChange}
      onComplete={handleCompleteTask}
      isAdmin={isAdmin}
      onAddCategory={isAdmin ? handleAddCategory : undefined}
      onRemoveCategory={isAdmin ? handleRemoveCategory : undefined}
    />
  );
}
