import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import KanbanBoard from '../../taskboard/components/KanbanBoard';
import AddTaskDialog from '../../taskboard/components/AddTaskDialog';
import TaskDrawer from '../../taskboard/components/TaskDrawer';
import { useTaskboardFilter } from '../../context/TaskboardFilterContext';
import { filterTasksByAssignee } from '../../lib/taskboard/filterUtils';
import type { Task, TaskGroup } from '../../lib/taskboard/types';
import type { TaskCategory } from '../../lib/taskboard/constants';
import {
  createTask,
  fetchActiveTasks,
  fetchProjectBySlug,
  nestTaskUnderParent,
  promoteTaskToParent,
  reorderTasks,
  subscribeToProjectTasks,
  updateTask,
} from '../../lib/taskboard/taskService';
import type { Project } from '../../lib/taskboard/types';

export default function ProjectBoardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const { assigneeFilter } = useTaskboardFilter();

  const filteredTasks = useMemo(
    () => filterTasksByAssignee(tasks, assigneeFilter),
    [tasks, assigneeFilter]
  );

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const proj = await fetchProjectBySlug(slug);
      setProject(proj);
      const data = await fetchActiveTasks(proj.id);
      setTasks(data);
      setError('');
    } catch {
      setError('Could not load project tasks.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!project) return;
    return subscribeToProjectTasks(project.id, load);
  }, [project, load]);

  const handleAddTask = async (category: TaskCategory) => {
    if (!project) return;
    const task = await createTask({ project_id: project.id, category });
    setSelectedTask(task);
    await load();
  };

  const handleCategoryChange = async (taskId: string, category: TaskCategory) => {
    await updateTask(taskId, { category });
    const subtasks = tasks.filter((t) => t.parent_task_id === taskId);
    await Promise.all(subtasks.map((sub) => updateTask(sub.id, { category })));
    await load();
  };

  const handleAddSubtask = async (parentId: string) => {
    if (!project || !selectedTask) return;
    try {
      const parent = tasks.find((t) => t.id === parentId);
      if (!parent) return;
      const sub = await createTask({
        project_id: project.id,
        category: parent.category,
        parent_task_id: parentId,
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
    return <p className="px-6 text-sm tb-muted">Loading…</p>;
  }

  if (!project) {
    return <p className="px-6 text-sm text-red-600">Project not found.</p>;
  }

  return (
    <div className="max-w-[100vw]">
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 mb-8">
        <Link
          to="/taskboard"
          className="inline-flex items-center gap-2 tb-link mb-6"
        >
          <ArrowLeft size={16} />
          Projects
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="tb-heading-lg">{project.name}</h1>
          <button
            type="button"
            onClick={() => setAddTaskOpen(true)}
            className="tb-add-btn px-3 py-2 border border-[#dadce0] rounded-lg hover:bg-[#f8f9fa] transition-colors"
          >
            + Add task
          </button>
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 md:px-10">
        {filteredTasks.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm tb-muted mb-4">
              {tasks.length === 0
                ? 'No tasks yet.'
                : 'No tasks match the current filter.'}
            </p>
            <button
              type="button"
              onClick={() => setAddTaskOpen(true)}
              className="tb-add-btn px-4 py-2 border border-[#dadce0] rounded-lg hover:bg-[#f8f9fa] transition-colors"
            >
              + Add task
            </button>
          </div>
        ) : (
          <KanbanBoard
            tasks={filteredTasks}
            collapsed={collapsed}
            onToggleCollapse={(id) => setCollapsed((c) => ({ ...c, [id]: !c[id] }))}
            onTaskClick={setSelectedTask}
            onCompleteTask={handleCompleteTask}
            onMoveGroup={handleMoveGroup}
            onNestTask={handleNestTask}
            onPromoteTask={handlePromoteTask}
          />
        )}
      </div>

      <AddTaskDialog
        open={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        defaultProjectId={project.id}
        onCreate={async ({ category }) => {
          try {
            await handleAddTask(category);
          } catch {
            setError('Could not create task.');
            throw new Error('create failed');
          }
        }}
      />

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
