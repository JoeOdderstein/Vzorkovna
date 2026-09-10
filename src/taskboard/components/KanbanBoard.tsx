import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMemo, useRef, useState } from 'react';
import type { Task, TaskGroup } from '../../lib/taskboard/types';
import type { TaskCategory } from '../../lib/taskboard/constants';
import { TASK_CATEGORIES } from '../../lib/taskboard/constants';
import { buildGroupsByCategory } from '../../lib/taskboard/categoryUtils';
import TaskCard from './TaskCard';

const NEST_DWELL_MS = 750;
const NEST_MOVEMENT_THRESHOLD = 6;

type DwellAction =
  | { kind: 'nest'; id: string }
  | { kind: 'promote'; category: TaskCategory };

function getNestCandidate(
  overId: string,
  activeTaskId: string,
  taskById: Map<string, Task>
): string | null {
  if (overId === activeTaskId) return null;
  if (TASK_CATEGORIES.some((c) => c.id === overId)) return null;

  const overTask = taskById.get(overId);
  const activeTask = taskById.get(activeTaskId);
  if (!overTask || !activeTask) return null;
  if (overTask.parent_task_id) return null;
  if (activeTask.parent_task_id === overId) return null;

  const isChildOfActive = [...taskById.values()].some(
    (t) => t.parent_task_id === activeTaskId && t.id === overId
  );
  if (isChildOfActive) return null;

  return overId;
}

function getPromoteCandidate(
  overId: string,
  activeTaskId: string,
  taskById: Map<string, Task>,
  groupsByCategory: Record<TaskCategory, TaskGroup[]>
): TaskCategory | null {
  const activeTask = taskById.get(activeTaskId);
  if (!activeTask?.parent_task_id) return null;

  if (TASK_CATEGORIES.some((c) => c.id === overId)) {
    return overId as TaskCategory;
  }

  if (getNestCandidate(overId, activeTaskId, taskById)) return null;

  for (const cat of TASK_CATEGORIES) {
    const inColumn = groupsByCategory[cat.id].some(
      (g) => g.parent.id === overId || g.subtasks.some((s) => s.id === overId)
    );
    if (inColumn) return cat.id;
  }

  return null;
}

interface KanbanBoardProps {
  tasks: Task[];
  collapsed: Record<string, boolean>;
  onToggleCollapse: (parentId: string) => void;
  onTaskClick: (task: Task) => void;
  onCompleteTask: (taskId: string) => void;
  onMoveGroup: (group: TaskGroup, toCategory: TaskCategory, overTaskId: string | null) => void;
  onNestTask: (taskId: string, targetParentId: string) => void;
  onPromoteTask: (taskId: string, category: TaskCategory) => void;
  onCreateTask: (category: TaskCategory) => void;
  creatingCategory?: TaskCategory | null;
}

function NestDropTarget({
  showNestHint,
  children,
}: {
  showNestHint: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative rounded-lg transition-colors ${showNestHint ? 'tb-nest-ready' : ''}`}>
      {showNestHint && <span className="tb-nest-hint">Add as subtask</span>}
      {children}
    </div>
  );
}

function DraggableSubtask({
  task,
  onTaskClick,
  onCompleteTask,
}: {
  task: Task;
  onTaskClick: (task: Task) => void;
  onCompleteTask: (taskId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: isDragging ? 10 : undefined }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`tb-task-draggable ${isDragging ? 'opacity-40' : ''}`}
      {...listeners}
      {...attributes}
    >
      <TaskCard
        task={task}
        isSubtask
        onClick={() => onTaskClick(task)}
        onComplete={onCompleteTask}
      />
    </div>
  );
}

function SortableGroup({
  group,
  collapsed,
  nestReadyId,
  onToggleCollapse,
  onTaskClick,
  onCompleteTask,
}: {
  group: TaskGroup;
  collapsed: boolean;
  nestReadyId: string | null;
  onToggleCollapse: (id: string) => void;
  onTaskClick: (task: Task) => void;
  onCompleteTask: (taskId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.parent.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="space-y-1">
      <div className="flex-1 cursor-grab active:cursor-grabbing tb-task-draggable" {...attributes} {...listeners}>
        <NestDropTarget showNestHint={nestReadyId === group.parent.id}>
          <TaskCard
            task={group.parent}
            onClick={() => onTaskClick(group.parent)}
            onComplete={onCompleteTask}
            expandControl={
              group.subtasks.length > 0
                ? {
                    collapsed,
                    onToggle: () => onToggleCollapse(group.parent.id),
                  }
                : undefined
            }
          />
        </NestDropTarget>
      </div>
      {!collapsed && group.subtasks.length > 0 && (
        <div className="pl-4 space-y-1">
          {group.subtasks.map((sub) => (
            <DraggableSubtask
              key={sub.id}
              task={sub}
              onTaskClick={onTaskClick}
              onCompleteTask={onCompleteTask}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Column({
  categoryId,
  label,
  groups,
  collapsed,
  nestReadyId,
  promoteReadyCategory,
  isDraggingSubtask,
  isDragOver,
  isDragging,
  onToggleCollapse,
  onTaskClick,
  onCompleteTask,
  onCreateTask,
  creating,
}: {
  categoryId: TaskCategory;
  label: string;
  groups: TaskGroup[];
  collapsed: Record<string, boolean>;
  nestReadyId: string | null;
  promoteReadyCategory: TaskCategory | null;
  isDraggingSubtask: boolean;
  isDragOver: boolean;
  isDragging: boolean;
  onToggleCollapse: (id: string) => void;
  onTaskClick: (task: Task) => void;
  onCompleteTask: (taskId: string) => void;
  onCreateTask: (category: TaskCategory) => void;
  creating: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: categoryId });
  const ids = groups.map((g) => g.parent.id);
  const taskCount = groups.reduce((sum, group) => sum + 1 + group.subtasks.length, 0);
  const showPromoteHint = promoteReadyCategory === categoryId;
  const showDropHint = isDragging && !showPromoteHint && (isDragOver || isOver);

  return (
    <div className="flex-shrink-0 w-[280px] md:w-[300px] flex flex-col max-h-[calc(100vh-12rem)]">
      <div className="px-1 py-4">
        <div className="tb-category-header">
          <h3 className="tb-label">{label}</h3>
          {taskCount > 0 && (
            <span className="tb-category-count" aria-label={`${taskCount} task${taskCount === 1 ? '' : 's'}`}>
              {taskCount}
            </span>
          )}
        </div>
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`relative flex-1 overflow-y-auto space-y-2 pr-1 min-h-[120px] rounded-lg transition-colors ${
            showPromoteHint ? 'tb-column-promote-ready' : showDropHint ? 'tb-column-over' : ''
          } ${groups.length === 0 && isDragging ? 'border border-dashed border-[var(--tb-border)]' : ''}`}
        >
          {showPromoteHint && (
            <div className="tb-promote-hint">Make top-level task</div>
          )}
          {groups.length === 0 && isDragging && !showPromoteHint && (
            <p className="px-2 py-6 text-xs text-center tb-text-muted pointer-events-none">
              {isDraggingSubtask ? 'Hold to make top-level task' : 'Drop task here'}
            </p>
          )}
          {groups.map((group) => (
            <SortableGroup
              key={group.parent.id}
              group={group}
              collapsed={collapsed[group.parent.id] ?? true}
              nestReadyId={nestReadyId}
              onToggleCollapse={onToggleCollapse}
              onTaskClick={onTaskClick}
              onCompleteTask={onCompleteTask}
            />
          ))}
        </div>
      </SortableContext>
      <button
        type="button"
        onClick={() => onCreateTask(categoryId)}
        disabled={creating}
        className={`${groups.length > 0 ? 'mt-2' : 'mt-0'} w-full py-3 text-sm tb-new-task-btn tb-text-muted border border-dashed rounded-lg disabled:opacity-50 transition-colors`}
      >
        {creating ? 'Creating…' : '+ new task'}
      </button>
    </div>
  );
}

export default function KanbanBoard({
  tasks,
  collapsed,
  onToggleCollapse,
  onTaskClick,
  onMoveGroup,
  onCompleteTask,
  onNestTask,
  onPromoteTask,
  onCreateTask,
  creatingCategory = null,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [nestReadyId, setNestReadyId] = useState<string | null>(null);
  const [promoteReadyCategory, setPromoteReadyCategory] = useState<TaskCategory | null>(null);
  const [overColumnId, setOverColumnId] = useState<TaskCategory | null>(null);
  const dwellTimerRef = useRef<number | null>(null);
  const dwellActionRef = useRef<DwellAction | null>(null);
  const dwellReadyRef = useRef<DwellAction | null>(null);
  const pinnedCategoriesRef = useRef<TaskCategory[]>([]);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 320, tolerance: 8 },
    })
  );

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const groupsByCategory = useMemo(() => buildGroupsByCategory(tasks), [tasks]);

  const activeTask = activeId ? taskById.get(activeId) : null;
  const isDragging = activeId !== null;
  const isDraggingSubtask = Boolean(activeTask?.parent_task_id);

  const visibleCategories = useMemo(() => {
    const withTasks = TASK_CATEGORIES.filter(({ id }) => groupsByCategory[id].length > 0);

    if (!isDragging) {
      return withTasks.length > 0 ? withTasks : TASK_CATEGORIES;
    }

    const pinned = pinnedCategoriesRef.current;
    const pinnedItems = TASK_CATEGORIES.filter(({ id }) => pinned.includes(id)).sort(
      (a, b) => pinned.indexOf(a.id) - pinned.indexOf(b.id)
    );
    const rest = TASK_CATEGORIES.filter(({ id }) => !pinned.includes(id));
    return [...pinnedItems, ...rest];
  }, [groupsByCategory, isDragging]);

  const snapshotPinnedCategories = () => {
    const withTasks = TASK_CATEGORIES.filter(({ id }) => groupsByCategory[id].length > 0).map(
      ({ id }) => id
    );
    pinnedCategoriesRef.current =
      withTasks.length > 0 ? withTasks : TASK_CATEGORIES.map(({ id }) => id);
  };

  const clearPinnedCategories = () => {
    pinnedCategoriesRef.current = [];
  };

  const clearDwellTimer = () => {
    if (dwellTimerRef.current !== null) {
      window.clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
  };

  const resetDwell = () => {
    clearDwellTimer();
    dwellActionRef.current = null;
    dwellReadyRef.current = null;
    setNestReadyId(null);
    setPromoteReadyCategory(null);
  };

  const scheduleDwell = (action: DwellAction) => {
    const samePending =
      dwellActionRef.current?.kind === action.kind &&
      (action.kind === 'nest'
        ? dwellActionRef.current.kind === 'nest' && dwellActionRef.current.id === action.id
        : dwellActionRef.current.kind === 'promote' &&
          dwellActionRef.current.category === action.category) &&
      dwellTimerRef.current !== null;
    if (samePending) return;

    clearDwellTimer();
    dwellActionRef.current = action;
    dwellTimerRef.current = window.setTimeout(() => {
      dwellReadyRef.current = action;
      if (action.kind === 'nest') {
        setNestReadyId(action.id);
        setPromoteReadyCategory(null);
      } else {
        setPromoteReadyCategory(action.category);
        setNestReadyId(null);
      }
      dwellTimerRef.current = null;
    }, NEST_DWELL_MS);
  };

  const isSameDwellReady = (action: DwellAction) => {
    const ready = dwellReadyRef.current;
    if (!ready || ready.kind !== action.kind) return false;
    return action.kind === 'nest' ? ready.id === action.id : ready.category === action.category;
  };

  const resolveColumnForOverId = (overId: string): TaskCategory | null => {
    if (TASK_CATEGORIES.some((c) => c.id === overId)) return overId as TaskCategory;
    for (const cat of TASK_CATEGORIES) {
      const inColumn = groupsByCategory[cat.id].some(
        (g) => g.parent.id === overId || g.subtasks.some((s) => s.id === overId)
      );
      if (inColumn) return cat.id;
    }
    return null;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over ? String(event.over.id) : null;
    const activeTaskId = String(event.active.id);

    setOverColumnId(overId ? resolveColumnForOverId(overId) : null);

    const movement = Math.hypot(event.delta.x, event.delta.y);
    if (movement > NEST_MOVEMENT_THRESHOLD) {
      resetDwell();
    }

    const nestCandidate = overId ? getNestCandidate(overId, activeTaskId, taskById) : null;
    if (nestCandidate) {
      const action: DwellAction = { kind: 'nest', id: nestCandidate };
      if (isSameDwellReady(action)) return;
      scheduleDwell(action);
      return;
    }

    const promoteCandidate = overId
      ? getPromoteCandidate(overId, activeTaskId, taskById, groupsByCategory)
      : null;
    if (promoteCandidate) {
      const action: DwellAction = { kind: 'promote', category: promoteCandidate };
      if (isSameDwellReady(action)) return;
      scheduleDwell(action);
      return;
    }

    resetDwell();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const readyAction = dwellReadyRef.current;
    resetDwell();
    clearPinnedCategories();
    setActiveId(null);
    setOverColumnId(null);

    const { active, over } = event;
    if (!over) return;

    const activeTaskId = String(active.id);
    const dragged = taskById.get(activeTaskId);
    if (!dragged) return;

    if (readyAction?.kind === 'nest' && activeTaskId !== readyAction.id) {
      onNestTask(activeTaskId, readyAction.id);
      return;
    }

    if (readyAction?.kind === 'promote') {
      onPromoteTask(activeTaskId, readyAction.category);
      return;
    }

    const isSubtask = Boolean(dragged.parent_task_id);
    if (isSubtask) return;

    let sourceGroup: TaskGroup | undefined;
    let sourceCategory: TaskCategory | undefined;

    for (const cat of TASK_CATEGORIES) {
      const found = groupsByCategory[cat.id].find((g) => g.parent.id === activeTaskId);
      if (found) {
        sourceGroup = found;
        sourceCategory = cat.id;
        break;
      }
    }
    if (!sourceGroup || !sourceCategory) return;

    const overId = String(over.id);
    let targetCategory = sourceCategory;
    let overTaskId: string | null = null;

    if (TASK_CATEGORIES.some((c) => c.id === overId)) {
      targetCategory = overId as TaskCategory;
      overTaskId = null;
    } else {
      for (const cat of TASK_CATEGORIES) {
        const match = groupsByCategory[cat.id].find((g) => g.parent.id === overId);
        if (match) {
          targetCategory = cat.id;
          overTaskId = overId;
          break;
        }
      }
    }

    onMoveGroup(sourceGroup, targetCategory, overTaskId);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e: DragStartEvent) => {
        resetDwell();
        snapshotPinnedCategories();
        setActiveId(String(e.active.id));
      }}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        resetDwell();
        clearPinnedCategories();
        setActiveId(null);
        setOverColumnId(null);
      }}
    >
      <div
        className="tb-kanban-scroll flex items-start gap-4 md:gap-6 overflow-x-auto px-1 pb-2"
      >
        {visibleCategories.map(({ id, label }) => (
          <div key={id} data-category={id}>
            <Column
              categoryId={id}
              label={label}
              groups={groupsByCategory[id]}
              collapsed={collapsed}
              nestReadyId={nestReadyId}
              promoteReadyCategory={promoteReadyCategory}
              isDraggingSubtask={isDraggingSubtask}
              isDragOver={overColumnId === id}
              isDragging={isDragging}
              onToggleCollapse={onToggleCollapse}
              onTaskClick={onTaskClick}
              onCompleteTask={onCompleteTask}
              onCreateTask={onCreateTask}
              creating={creatingCategory === id}
            />
          </div>
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask && (
          <div className="opacity-95 shadow-lg">
            <TaskCard
              task={activeTask}
              isSubtask={Boolean(activeTask.parent_task_id)}
              onClick={() => {}}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
