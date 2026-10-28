import { useCallback, useEffect, useRef, useState } from 'react';
import { useCompleteUndo } from '../../context/CompleteUndoContext';
import { useTaskboardSelection } from '../../context/TaskboardSelectionContext';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import type { TaskCategory } from '../../lib/taskboard/constants';
import type { CategoryOption, Project, Task } from '../../lib/taskboard/types';
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
  fetchVisibleProjects,
  updateTask,
} from '../../lib/taskboard/taskService';
import { withRetry } from '../../lib/taskboard/loadUtils';
import TaskDrawer from './TaskDrawer';

export default function TaskDrawerHost() {
  const { selected, taskSnapshot, taskChangeToken, openTask, closeTask, notifyTaskChange } =
    useTaskboardSelection();
  const { showCompleteUndo, dismissCompleteUndo } = useCompleteUndo();
  const { username, isAdmin } = useTaskboardAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>(DEFAULT_CATEGORIES);
  const [projects, setProjects] = useState<Project[]>([]);
  const categoriesByProjectRef = useRef(new Map<string, CategoryOption[]>());
  const skipTaskRefetchOnceRef = useRef(false);

  const resolveCategoriesForProject = useCallback(async (projectId: string) => {
    const cached = categoriesByProjectRef.current.get(projectId);
    if (cached) return cached;

    const options = await fetchCategoriesForProject(projectId).catch(() => DEFAULT_CATEGORIES);
    categoriesByProjectRef.current.set(projectId, options);
    return options;
  }, []);

  useEffect(() => {
    if (!selected) {
      setTask(null);
      return;
    }

    if (taskSnapshot?.id === selected.taskId) {
      setTask(taskSnapshot);
    }

    let cancelled = false;

    if (skipTaskRefetchOnceRef.current) {
      skipTaskRefetchOnceRef.current = false;
      return () => {
        cancelled = true;
      };
    }

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

  const selectedProjectId = selected?.projectId ?? null;

  useEffect(() => {
    if (!selectedProjectId) {
      setCategories(DEFAULT_CATEGORIES);
      return;
    }

    void resolveCategoriesForProject(selectedProjectId)
      .then(setCategories)
      .catch(() => setCategories(DEFAULT_CATEGORIES));
  }, [selectedProjectId, resolveCategoriesForProject]);

  useEffect(() => {
    if (!selected) return;

    void fetchVisibleProjects(username, isAdmin)
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [selected, username, isAdmin]);

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

  const handleProjectChange = useCallback(
    async (taskId: string, projectId: string) => {
      if (!selected || projectId === selected.projectId) return;

      const categoryOptions = await resolveCategoriesForProject(projectId);
      const currentCategory = task?.category ?? DEFAULT_CATEGORIES[0].id;
      const categoryStillValid = categoryOptions.some((item) => item.id === currentCategory);
      const nextCategory = categoryStillValid
        ? currentCategory
        : (categoryOptions[0]?.id ?? currentCategory);

      const updated = await updateTask(taskId, {
        project_id: projectId,
        category: nextCategory,
      });

      skipTaskRefetchOnceRef.current = true;
      setTask(updated);
      setCategories(categoryOptions);
      openTask(updated, projectId);
      window.setTimeout(() => notifyTaskChange(), 0);
    },
    [selected, task, notifyTaskChange, openTask, resolveCategoriesForProject]
  );

  const handleAddSubtask = useCallback(
    async (parentId: string) => {
      if (!selected) return;
      const tasks = await fetchActiveTasks(selected.projectId);
      const parent = tasks.find((t) => t.id === parentId);
      if (!parent) return;

      const sub = await createTask(
        {
          project_id: selected.projectId,
          category: parent.category,
          parent_task_id: parentId,
          assignees: [...parent.assignees],
          notify_assign_emails: parent.notify_assign_emails,
          priority: parent.priority,
          deadline: parent.deadline,
        },
        { skipAssignmentNotify: true }
      );
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
      categoriesByProjectRef.current.set(selected.projectId, next);
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
      categoriesByProjectRef.current.set(selected.projectId, next);
      setCategories(next);
      notifyTaskChange();
    },
    [selected, notifyTaskChange]
  );

  const drawerTask =
    task ?? (taskSnapshot?.id === selected?.taskId ? taskSnapshot : null);

  if (!selected || !drawerTask) return null;

  return (
    <TaskDrawer
      task={drawerTask}
      projectId={selected.projectId}
      category={drawerTask.category}
      categories={categories}
      projects={projects}
      onClose={closeTask}
      onSaved={handleSaved}
      onAddSubtask={handleAddSubtask}
      onProjectChange={handleProjectChange}
      onCategoryChange={handleCategoryChange}
      onComplete={handleCompleteTask}
      isAdmin={isAdmin}
      onAddCategory={isAdmin ? handleAddCategory : undefined}
      onRemoveCategory={isAdmin ? handleRemoveCategory : undefined}
    />
  );
}
