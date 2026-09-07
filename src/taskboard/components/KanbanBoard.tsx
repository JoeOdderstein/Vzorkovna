import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  pointerWithin,
  useDraggable,
  useDroppable,
  type CollisionDetection,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMemo, useState } from 'react';
import type { Task, TaskGroup } from '../../lib/taskboard/types';
import type { TaskCategory } from '../../lib/taskboard/constants';
import { TASK_CATEGORIES } from '../../lib/taskboard/constants';
import { getVisibleCategories } from '../../lib/taskboard/categoryUtils';
import TaskCard from './TaskCard';

const nestId = (taskId: string) => `nest-${taskId}`;

function parseNestId(id: string) {
  return id.startsWith('nest-') ? id.slice(5) : null;
}

const nestCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const nestCollision = pointerCollisions.find((c) => String(c.id).startsWith('nest-'));
  if (nestCollision) return [nestCollision];
  return closestCorners(args);
};

interface KanbanBoardProps {
  tasks: Task[];
  collapsed: Record<string, boolean>;
  onToggleCollapse: (parentId: string) => void;
  onTaskClick: (task: Task) => void;
  onCompleteTask: (taskId: string) => void;
  onMoveGroup: (group: TaskGroup, toCategory: TaskCategory, toIndex: number) => void;
  onNestTask: (taskId: string, targetParentId: string) => void;
  onPromoteTask: (taskId: string, category: TaskCategory) => void;
}

function NestDropTarget({
  taskId,
  isOver,
  children,
}: {
  taskId: string;
  isOver: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: nestId(taskId) });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg transition-colors ${isOver ? 'ring-2 ring-[#1a73e8] bg-[#e8f0fe]' : ''}`}
    >
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
      className={isDragging ? 'opacity-40' : undefined}
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
  overNestId,
  onToggleCollapse,
  onTaskClick,
  onCompleteTask,
}: {
  group: TaskGroup;
  collapsed: boolean;
  overNestId: string | null;
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
      <div className="flex-1" {...attributes} {...listeners}>
        <NestDropTarget taskId={group.parent.id} isOver={overNestId === group.parent.id}>
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
  overNestId,
  onToggleCollapse,
  onTaskClick,
  onCompleteTask,
}: {
  categoryId: TaskCategory;
  label: string;
  groups: TaskGroup[];
  collapsed: Record<string, boolean>;
  overNestId: string | null;
  onToggleCollapse: (id: string) => void;
  onTaskClick: (task: Task) => void;
  onCompleteTask: (taskId: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: categoryId });
  const ids = groups.map((g) => g.parent.id);

  return (
    <div className="flex-shrink-0 w-[280px] md:w-[300px] flex flex-col max-h-[calc(100vh-12rem)]">
      <h3 className="tb-label mb-4 px-1">{label}</h3>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[80px]">
          {groups.map((group) => (
            <SortableGroup
              key={group.parent.id}
              group={group}
              collapsed={collapsed[group.parent.id] ?? false}
              overNestId={overNestId}
              onToggleCollapse={onToggleCollapse}
              onTaskClick={onTaskClick}
              onCompleteTask={onCompleteTask}
            />
          ))}
        </div>
      </SortableContext>
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
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overNestId, setOverNestId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const visibleCategories = useMemo(() => getVisibleCategories(tasks), [tasks]);

  const groupsByCategory = useMemo(() => {
    const map: Record<TaskCategory, TaskGroup[]> = {
      quotations: [],
      designing: [],
      installation: [],
      repairs: [],
    };

    TASK_CATEGORIES.forEach(({ id }) => {
      const parents = tasks
        .filter((t) => t.category === id && !t.parent_task_id)
        .sort((a, b) => a.sort_order - b.sort_order);
      map[id] = parents.map((parent) => ({
        parent,
        subtasks: tasks
          .filter((t) => t.parent_task_id === parent.id)
          .sort((a, b) => a.sort_order - b.sort_order),
      }));
    });

    return map;
  }, [tasks]);

  const activeTask = activeId ? taskById.get(activeId) : null;

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over ? String(event.over.id) : null;
    setOverNestId(overId ? parseNestId(overId) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setOverNestId(null);

    const { active, over } = event;
    if (!over) return;

    const activeTaskId = String(active.id);
    const overId = String(over.id);
    const dragged = taskById.get(activeTaskId);
    if (!dragged) return;

    const nestTargetId = parseNestId(overId);
    if (nestTargetId && activeTaskId !== nestTargetId) {
      onNestTask(activeTaskId, nestTargetId);
      return;
    }

    const isSubtask = Boolean(dragged.parent_task_id);

    if (isSubtask) {
      if (TASK_CATEGORIES.some((c) => c.id === overId)) {
        onPromoteTask(activeTaskId, overId as TaskCategory);
        return;
      }

      const targetParent = taskById.get(overId);
      if (targetParent && !targetParent.parent_task_id && activeTaskId !== overId) {
        onNestTask(activeTaskId, overId);
      }
      return;
    }

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

    let targetCategory = sourceCategory;
    let targetIndex = groupsByCategory[sourceCategory].findIndex((g) => g.parent.id === overId);

    for (const cat of TASK_CATEGORIES) {
      if (cat.id === overId) {
        targetCategory = cat.id;
        targetIndex = groupsByCategory[cat.id].length;
        break;
      }
      const idx = groupsByCategory[cat.id].findIndex((g) => g.parent.id === overId);
      if (idx >= 0) {
        targetCategory = cat.id;
        targetIndex = idx;
        break;
      }
    }

    if (targetIndex < 0) targetIndex = groupsByCategory[targetCategory].length;

    onMoveGroup(sourceGroup, targetCategory, targetIndex);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={nestCollisionDetection}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setOverNestId(null);
      }}
    >
      <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 px-1">
        {visibleCategories.map(({ id, label }) => (
          <div key={id} id={id} data-category={id}>
            <Column
              categoryId={id}
              label={label}
              groups={groupsByCategory[id]}
              collapsed={collapsed}
              overNestId={overNestId}
              onToggleCollapse={onToggleCollapse}
              onTaskClick={onTaskClick}
              onCompleteTask={onCompleteTask}
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
