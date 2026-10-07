import { isSupabaseConfigured } from '../taskboard/config';

/** Fire-and-forget — emails people assigned on the bug report. */
export function notifyRepairComment(payload: {
  repairId: string;
  commentId: string;
  installationId: string;
  notifyUsernames?: string[];
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
          return;
        }
        if ((data.notified ?? 0) === 0) {
          const skipped = Array.isArray(data.skipped) ? data.skipped : [];
          console.warn(
            '[installations] repair comment notification: no email sent.',
            skipped.length > 0 ? skipped : data,
          );
        }
      })
      .catch((err) => {
        console.warn('[installations] repair comment notification request failed:', err);
      });
  }, 0);
}
