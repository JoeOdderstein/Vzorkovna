import { isSupabaseConfigured } from './config';

/** Fire-and-forget — never blocks the UI after posting a comment. */
export function notifyTaskComment(taskId: string, commentId: string): void {
  if (!isSupabaseConfigured()) return;

  window.setTimeout(() => {
    fetch('/api/tasks/notify-comment', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, commentId }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.warn('[taskboard] comment notification failed:', res.status, data);
          return;
        }
        if ((data.notified ?? 0) === 0) {
          const skipped = Array.isArray(data.skipped) ? data.skipped : [];
          const reasons = skipped.map(
            (item: { assignee?: string; reason?: string; detail?: string }) =>
              `${item.assignee ?? '?'}: ${item.reason ?? 'unknown'}${item.detail ? ` (${item.detail})` : ''}`
          );
          console.warn(
            '[taskboard] comment notification: no email sent.',
            reasons.length > 0 ? reasons.join('; ') : data
          );
        } else if (import.meta.env.DEV) {
          console.info('[taskboard] comment notification sent', data);
        }
      })
      .catch((err) => {
        console.warn('[taskboard] comment notification request failed:', err);
      });
  }, 0);
}
