import type { TaskCategory } from './constants';
import type { Project, Task, TaskInsert, TaskUpdate } from './types';
import { normalizeTask } from './assigneeUtils';
import { ensureUniqueSlug, slugifyProjectName } from './projectUtils';

const STORAGE_KEY = 'taskboard_local_tasks_v1';
const PROJECTS_STORAGE_KEY = 'taskboard_local_projects_v1';

const SEED_PROJECTS: Project[] = [
  { id: 'p1', name: 'Tank Shots', slug: 'tank-shots', sort_order: 1, created_at: '' },
  { id: 'p2', name: 'Elements Room', slug: 'elements-room', sort_order: 2, created_at: '' },
  { id: 'p3', name: 'Entrance Statue', slug: 'entrance-statue', sort_order: 3, created_at: '' },
  { id: 'p4', name: 'Infinity Room', slug: 'infinity-room', sort_order: 4, created_at: '' },
  { id: 'p5', name: 'VR Room', slug: 'vr-room', sort_order: 5, created_at: '' },
  { id: 'p6', name: 'Dog Slap Shot', slug: 'dog-slap-shot', sort_order: 6, created_at: '' },
  { id: 'p7', name: 'Krakow Dragon Ribs', slug: 'krakow-dragon-ribs', sort_order: 7, created_at: '' },
  { id: 'p8', name: 'Vulva Room', slug: 'vulva-room', sort_order: 8, created_at: '' },
];

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Record<string, unknown>[]).map(normalizeTask);
  } catch {
    return [];
  }
}

function saveTasks(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return [...SEED_PROJECTS];
    return JSON.parse(raw) as Project[];
  } catch {
    return [...SEED_PROJECTS];
  }
}

function saveProjects(projects: Project[]) {
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

function newId() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

export const localStore = {
  getProjects: () => loadProjects(),

  getProjectBySlug: (slug: string) => loadProjects().find((p) => p.slug === slug) ?? null,

  createProject: (name: string): Project => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Project name is required');

    const projects = loadProjects();
    const slug = ensureUniqueSlug(
      slugifyProjectName(trimmed),
      projects.map((p) => p.slug)
    );
    const sort_order = projects.reduce((max, p) => Math.max(max, p.sort_order), 0) + 1;

    const project: Project = {
      id: newId(),
      name: trimmed,
      slug,
      sort_order,
      created_at: now(),
    };

    saveProjects([...projects, project]);
    return project;
  },

  updateProject: (id: string, name: string): Project => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Project name is required');

    const projects = loadProjects();
    const idx = projects.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error('Project not found');

    const slug = ensureUniqueSlug(
      slugifyProjectName(trimmed),
      projects.filter((p) => p.id !== id).map((p) => p.slug)
    );

    const updated: Project = { ...projects[idx], name: trimmed, slug };
    projects[idx] = updated;
    saveProjects(projects);
    return updated;
  },

  deleteProject: (id: string): void => {
    const projects = loadProjects();
    if (!projects.some((p) => p.id === id)) throw new Error('Project not found');

    saveProjects(projects.filter((p) => p.id !== id));
    saveTasks(loadTasks().filter((t) => t.project_id !== id));
  },

  getActiveTasks: (projectId: string) =>
    loadTasks().filter((t) => t.project_id === projectId && !t.completed),

  getAllActiveTasks: () => loadTasks().filter((t) => !t.completed),

  getActiveTaskCountsByProject: () => {
    const counts = Object.fromEntries(loadProjects().map((p) => [p.id, 0]));
    for (const task of loadTasks()) {
      if (!task.completed) {
        counts[task.project_id] = (counts[task.project_id] ?? 0) + 1;
      }
    }
    return counts;
  },

  getArchivedTasks: (search: string) => {
    let tasks = loadTasks().filter((t) => t.completed);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      tasks = tasks.filter((t) => t.task_name.toLowerCase().includes(q));
    }
    return tasks.map((t) => ({
      ...t,
      project: loadProjects().find((p) => p.id === t.project_id),
    }));
  },

  createTask: (input: TaskInsert): Task => {
    const tasks = loadTasks();
    const parent = input.parent_task_id
      ? tasks.find((t) => t.id === input.parent_task_id)
      : null;

    if (input.parent_task_id && parent?.parent_task_id) {
      throw new Error('Subtasks cannot have subtasks');
    }

    const siblings = tasks.filter(
      (t) =>
        t.project_id === input.project_id &&
        t.category === input.category &&
        !t.completed &&
        (t.parent_task_id ?? null) === (input.parent_task_id ?? null)
    );

    const task: Task = {
      id: newId(),
      project_id: input.project_id,
      parent_task_id: input.parent_task_id ?? null,
      category: parent?.category ?? input.category,
      task_name: input.task_name ?? 'New task',
      description: input.description ?? '',
      assignees: input.assignees ?? [...(parent?.assignees ?? [])],
      priority: input.priority ?? parent?.priority ?? 'normal',
      deadline: input.deadline !== undefined ? input.deadline : (parent?.deadline ?? null),
      completed: false,
      completed_at: null,
      google_drive_url: null,
      attachment_path: null,
      attachment_name: null,
      sort_order: input.sort_order ?? siblings.length,
      created_at: now(),
      updated_at: now(),
    };

    tasks.push(task);
    saveTasks(tasks);
    return task;
  },

  updateTask: (id: string, updates: TaskUpdate): Task => {
    const tasks = loadTasks();
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx < 0) throw new Error('Task not found');

    const updated: Task = {
      ...tasks[idx],
      ...updates,
      updated_at: now(),
      completed_at:
        updates.completed === true
          ? now()
          : updates.completed === false
            ? null
            : tasks[idx].completed_at,
    };

    tasks[idx] = updated;
    saveTasks(tasks);
    return updated;
  },

  reorderTasks: (
    updates: { id: string; category: TaskCategory; sort_order: number; parent_task_id?: string | null }[]
  ) => {
    const tasks = loadTasks();
    for (const u of updates) {
      const idx = tasks.findIndex((t) => t.id === u.id);
      if (idx >= 0) {
        tasks[idx] = {
          ...tasks[idx],
          category: u.category,
          sort_order: u.sort_order,
          ...(u.parent_task_id !== undefined ? { parent_task_id: u.parent_task_id } : {}),
          updated_at: now(),
        };
      }
    }
    saveTasks(tasks);
  },

  nestTask: (taskId: string, targetParentId: string) => {
    const tasks = loadTasks();
    const draggedIdx = tasks.findIndex((t) => t.id === taskId);
    const target = tasks.find((t) => t.id === targetParentId);
    if (draggedIdx < 0 || !target) throw new Error('Task not found');

    const dragged = tasks[draggedIdx];
    if (taskId === targetParentId) return dragged;
    if (target.parent_task_id) throw new Error('Can only nest under top-level tasks');
    if (tasks.some((t) => t.id === targetParentId && t.parent_task_id === taskId)) {
      throw new Error('Invalid nest target');
    }

    const wasTopLevel = !dragged.parent_task_id;
    const oldCategory = dragged.category;

    const childSubtasks = tasks.filter((t) => t.parent_task_id === taskId);
    const topLevelInTargetCategory = tasks.filter(
      (t) =>
        t.project_id === dragged.project_id &&
        t.category === target.category &&
        !t.parent_task_id &&
        !t.completed &&
        t.id !== taskId
    );
    let topOrder = topLevelInTargetCategory.length;

    for (const sub of childSubtasks) {
      sub.parent_task_id = null;
      sub.category = target.category;
      sub.sort_order = topOrder++;
      sub.updated_at = now();
    }

    const siblingSubtasks = tasks.filter(
      (t) => t.parent_task_id === targetParentId && t.id !== taskId
    );
    const subSort =
      siblingSubtasks.length > 0
        ? Math.max(...siblingSubtasks.map((s) => s.sort_order)) + 1
        : 0;

    tasks[draggedIdx] = {
      ...dragged,
      parent_task_id: targetParentId,
      category: target.category,
      sort_order: subSort,
      updated_at: now(),
    };

    if (wasTopLevel) {
      const remaining = tasks
        .filter(
          (t) =>
            t.project_id === dragged.project_id &&
            t.category === oldCategory &&
            !t.parent_task_id &&
            !t.completed
        )
        .sort((a, b) => a.sort_order - b.sort_order);
      remaining.forEach((t, i) => {
        t.sort_order = i;
        t.updated_at = now();
      });
    }

    saveTasks(tasks);
    return tasks[draggedIdx];
  },

  promoteTask: (taskId: string, category: TaskCategory, sortOrder: number) => {
    const tasks = loadTasks();
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx < 0) throw new Error('Task not found');

    const task = tasks[idx];
    if (!task.parent_task_id) return task;

    tasks[idx] = {
      ...task,
      parent_task_id: null,
      category,
      sort_order: sortOrder,
      updated_at: now(),
    };

    const parents = tasks
      .filter(
        (t) =>
          t.project_id === task.project_id &&
          t.category === category &&
          !t.parent_task_id &&
          !t.completed
      )
      .sort((a, b) => a.sort_order - b.sort_order);

    parents.forEach((t, i) => {
      t.sort_order = i;
      t.updated_at = now();
    });

    saveTasks(tasks);
    return tasks[idx];
  },

  subscribe: (_projectId: string, _onChange: () => void) => () => {},
};
