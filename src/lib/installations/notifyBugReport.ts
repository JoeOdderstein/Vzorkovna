export async function notifyBugReport(payload: {
  repairId: string;
  installationId: string;
  notifyUsernames: string[];
}) {
  const res = await fetch('/api/installations/notify-bug', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Could not send notifications.');
  }
}

export type NotifyRecipient = {
  username: string;
  board_name: string;
  email: string;
};

export async function fetchNotifyRecipients(): Promise<NotifyRecipient[]> {
  const res = await fetch('/api/auth/notify-recipients', { credentials: 'include' });
  if (!res.ok) {
    throw new Error('Could not load team list.');
  }
  const data = (await res.json()) as { recipients?: NotifyRecipient[] };
  return data.recipients ?? [];
}
