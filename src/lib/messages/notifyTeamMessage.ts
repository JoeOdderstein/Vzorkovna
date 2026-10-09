export async function notifyTeamMessagePosted(payload: {
  messageId: string;
  excludedUsernames: string[];
}): Promise<{ sent: number; failed: number }> {
  const res = await fetch('/api/messages/notify-post', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messageId: payload.messageId,
      excludedUsernames: payload.excludedUsernames.map((u) => u.trim().toLowerCase()).filter(Boolean),
    }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Could not send notifications.');
  }

  return (await res.json()) as { sent: number; failed: number };
}
