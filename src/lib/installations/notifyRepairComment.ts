import { isSupabaseConfigured } from '../taskboard/config';

/** Fire-and-forget — emails people assigned on the bug report. */
export function notifyRepairComment(payload: {
  repairId: string;
  commentId: string;
  installationId: string;
}): void {
  if (!isSupabaseConfigured()) return;

  window.setTimeout(() => {
    fetch('/api/installations/notify-repair-comment', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.warn('[installations] repair comment notification failed:', res.status, data);
        }
      })
      .catch((err) => {
        console.warn('[installations] repair comment notification request failed:', err);
      });
  }, 0);
}
