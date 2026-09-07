import type { Task } from './types';

export const LOCAL_TASKS_STORAGE_KEY = 'taskboard_local_tasks_v1';

/** Maps local-only project ids (p1–p8) to Supabase project slugs */
export const LOCAL_PROJECT_SLUGS: Record<string, string> = {
  p1: 'tank-shots',
  p2: 'elements-room',
  p3: 'entrance-statue',
  p4: 'infinity-room',
  p5: 'vr-room',
  p6: 'dog-slap-shot',
  p7: 'krakow-dragon-ribs',
  p8: 'vulva-room',
};

export function readLocalTasks(): Task[] {
  try {
    const raw = localStorage.getItem(LOCAL_TASKS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Task[]) : [];
  } catch {
    return [];
  }
}

export function getLocalTaskCount() {
  return readLocalTasks().length;
}

export function clearLocalTasks() {
  localStorage.removeItem(LOCAL_TASKS_STORAGE_KEY);
}
