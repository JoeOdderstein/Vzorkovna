import type { Assignee } from './constants';
import { isSupabaseConfigured } from './config';

/** Fire-and-forget — never blocks the UI or task save/close flow. */
export function notifyTaskAssignment(
  taskId: string,
  previousAssignees: Assignee[] = []
): void {
  if (!isSupabaseConfigured()) return;

  window.setTimeout(() => {
    fetch('/api/tasks/notify-assignment', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, previousAssignees }),
    })
      .then(async (res) => {
        if (!import.meta.env.DEV) return;
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.warn('[taskboard] assignment notification failed:', res.status, data);
        } else if ((data.notified ?? 0) === 0) {
          console.warn('[taskboard] assignment notification: no email sent', data);
        } else {
          console.info('[taskboard] assignment notification sent', data);
        }
      })
      .catch((err) => {
        if (import.meta.env.DEV) {
          console.warn('[taskboard] assignment notification failed:', err);
        }
      });
  }, 0);
}
