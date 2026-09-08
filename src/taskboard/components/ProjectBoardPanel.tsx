import { useCallback, useEffect, useMemo, useState } from 'react';
import KanbanBoard from './KanbanBoard';
import { useCompleteUndo } from '../../context/CompleteUndoContext';
import { useTaskboardFilter } from '../../context/TaskboardFilterContext';
import { useTaskboardSelection } from '../../context/TaskboardSelectionContext';
import { filterTasksByAssignee } from '../../lib/taskboard/filterUtils';
import type { Task, TaskGroup, Project } from '../../lib/taskboard/types';
import type { TaskCategory } from '../../lib/taskboard/constants';
import {
  createTask,
  fetchActiveTasks,
  nestTaskUnderParent,
  promoteTaskToParent,
  reorderTasks,
  subscribeToProjectTasks,
  updateTask,
} from '../../lib/taskboard/taskService';
import { withRetry } from '../../lib/taskboard/loadUtils';
import { applyTaskUpdates, computeMoveGroupUpdates } from '../../lib/taskboard/dragUtils';

interface ProjectBoardPanelProps {
  project: Project;
  initialTaskId?: string | null;
  onTasksChange?: () => void;
}

export default function ProjectBoardPanel({
  project,
  initialTaskId,
  onTasksChange,
}: ProjectBoardPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [creatingCategory, setCreatingCategory] = useState<TaskCategory | null>(null);
  const { assigneeFilter } = useTaskboardFilter();
  const { showCompleteUndo, dismissCompleteUndo } = useCompleteUndo();
  const { openTask, closeTask, selected, taskChangeToken, notifyTaskChange } =
    useTaskboardSelection();

  const filteredTasks = useMemo(
    () => filterTasksByAssignee(tasks, assigneeFilter),
    [tasks, assigneeFilter]
  );

  const load = useCallback(async () => {
    try {
      const data = await withRetry(() => fetchActiveTasks(project.id));
      setTasks(data);
      setError('');
      onTasksChange?.();
    } catch {
      setError('Could not load project tasks.');
    } finally {
      setLoading(false);
    }
  }, [project.id, onTasksChange]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => subscribeToProjectTasks(project.id, load), [project.id, load]);

  useEffect(() => {
    if (taskChangeToken === 0) return;
    load();
  }, [taskChangeToken, load]);

  useEffect(() => {
    if (!initialTaskId || tasks.length === 0) return;
    const match = tasks.find((t) => t.id === initialTaskId);
    if (match) openTask(match, project.id);
  }, [initialTaskId, tasks, project.id, openTask]);

  const handleAddTask = async (category: TaskCategory) => {
    const task = await createTask({ project_id: project.id, category });
    openTask(task, project.id);
    notifyTaskChange();
    await load();
  };

  const handleCreateInCategory = async (category: TaskCategory) => {
    setCreatingCategory(category);
    setError('');
    try {
      await handleAddTask(category);
    } catch {
      setError('Could not create task.');
    } finally {
      setCreatingCategory(null);
    }
  };

  const handleMoveGroup = async (
    group: TaskGroup,
    toCategory: TaskCategory,
    overTaskId: string | null
  ) => {
    const updates = computeMoveGroupUpdates(tasks, group, toCategory, overTaskId);
    const previousTasks = tasks;

    setTasks((prev) => applyTaskUpdates(prev, updates));

    try {
      await reorderTasks(updates);
      onTasksChange?.();
    } catch {
      setTasks(previousTasks);
      setError('Could not move task.');
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (selected?.taskId === taskId) closeTask();

    showCompleteUndo({
      taskName: task.task_name || 'Untitled task',
      onUndo: async () => {
        setTasks((prev) => [...prev, task]);
        await updateTask(task.id, { completed: false });
        onTasksChange?.();
        notifyTaskChange();
      },
    });

    try {
      await updateTask(taskId, { completed: true });
      onTasksChange?.();
      notifyTaskChange();
    } catch {
      dismissCompleteUndo();
      setTasks((prev) => [...prev, task]);
      setError('Could not complete task.');
    }
  };

  const handleNestTask = async (taskId: string, targetParentId: string) => {
    try {
      await nestTaskUnderParent(taskId, targetParentId);
      setCollapsed((c) => ({ ...c, [targetParentId]: false }));
      if (selected?.taskId === taskId) closeTask();
      await load();
    } catch {
      setError('Could not nest task.');
    }
  };

  const handlePromoteTask = async (taskId: string, category: TaskCategory) => {
    try {
      await promoteTaskToParent(taskId, category);
      await load();
    } catch {
      setError('Could not move task.');
    }
  };

  if (loading) {
    return <p className="py-6 text-sm tb-muted">Loading tasks…</p>;
  }

  return (
    <div className="pb-2">
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {filteredTasks.length === 0 && tasks.length > 0 ? (
        <p className="py-4 text-sm tb-muted">No tasks match the current filter.</p>
      ) : (
        <div className="-mx-2">
          <KanbanBoard
            tasks={filteredTasks}
            collapsed={collapsed}
            onToggleCollapse={(id) => setCollapsed((c) => ({ ...c, [id]: !c[id] }))}
            onTaskClick={(task) => openTask(task, project.id)}
            onCompleteTask={handleCompleteTask}
            onMoveGroup={handleMoveGroup}
            onNestTask={handleNestTask}
            onPromoteTask={handlePromoteTask}
            onCreateTask={handleCreateInCategory}
            creatingCategory={creatingCategory}
          />
        </div>
      )}
    </div>
  );
}
