import { useCallback, useEffect, useMemo, useState } from 'react';
import KanbanBoard from './KanbanBoard';
import TaskDrawer from './TaskDrawer';
import { useTaskboardFilter } from '../../context/TaskboardFilterContext';
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
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [creatingCategory, setCreatingCategory] = useState<TaskCategory | null>(null);
  const { assigneeFilter } = useTaskboardFilter();

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
    if (!initialTaskId || tasks.length === 0) return;
    const match = tasks.find((t) => t.id === initialTaskId);
    if (match) setSelectedTask(match);
  }, [initialTaskId, tasks]);

  const handleAddTask = async (category: TaskCategory) => {
    const task = await createTask({ project_id: project.id, category });
    setSelectedTask(task);
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

  const handleCategoryChange = async (taskId: string, category: TaskCategory) => {
    await updateTask(taskId, { category });
    const subtasks = tasks.filter((t) => t.parent_task_id === taskId);
    await Promise.all(subtasks.map((sub) => updateTask(sub.id, { category })));
    await load();
  };

  const handleAddSubtask = async (parentId: string) => {
    try {
      const parent = tasks.find((t) => t.id === parentId);
      if (!parent) return;
      const sub = await createTask({
        project_id: project.id,
        category: parent.category,
        parent_task_id: parentId,
        assignees: [...parent.assignees],
        priority: parent.priority,
        deadline: parent.deadline,
      });
      setSelectedTask(sub);
      await load();
    } catch {
      setError('Could not create subtask.');
    }
  };

  const handleMoveGroup = async (group: TaskGroup, toCategory: TaskCategory, toIndex: number) => {
    const parentsInTarget = tasks
      .filter((t) => t.category === toCategory && !t.parent_task_id && t.id !== group.parent.id)
      .sort((a, b) => a.sort_order - b.sort_order);

    const updates: { id: string; category: TaskCategory; sort_order: number }[] = [];
    updates.push({ id: group.parent.id, category: toCategory, sort_order: toIndex });
    group.subtasks.forEach((sub) => {
      updates.push({ id: sub.id, category: toCategory, sort_order: sub.sort_order });
    });
    parentsInTarget.forEach((p, i) => {
      const order = i >= toIndex ? i + 1 : i;
      updates.push({ id: p.id, category: toCategory, sort_order: order });
    });

    try {
      await reorderTasks(updates);
      await load();
    } catch {
      setError('Could not move task.');
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await updateTask(taskId, { completed: true });
      if (selectedTask?.id === taskId) setSelectedTask(null);
      await load();
    } catch {
      setError('Could not complete task.');
    }
  };

  const handleNestTask = async (taskId: string, targetParentId: string) => {
    try {
      await nestTaskUnderParent(taskId, targetParentId);
      setCollapsed((c) => ({ ...c, [targetParentId]: false }));
      if (selectedTask?.id === taskId) setSelectedTask(null);
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
        <div className="-mx-2 overflow-x-auto">
          <KanbanBoard
            tasks={filteredTasks}
            collapsed={collapsed}
            onToggleCollapse={(id) => setCollapsed((c) => ({ ...c, [id]: !c[id] }))}
            onTaskClick={setSelectedTask}
            onCompleteTask={handleCompleteTask}
            onMoveGroup={handleMoveGroup}
            onNestTask={handleNestTask}
            onPromoteTask={handlePromoteTask}
            onCreateTask={handleCreateInCategory}
            creatingCategory={creatingCategory}
          />
        </div>
      )}

      {selectedTask && (
        <TaskDrawer
          task={selectedTask}
          projectId={project.id}
          category={selectedTask.category}
          onClose={() => setSelectedTask(null)}
          onSaved={load}
          onAddSubtask={handleAddSubtask}
          onCategoryChange={handleCategoryChange}
        />
      )}
    </div>
  );
}
