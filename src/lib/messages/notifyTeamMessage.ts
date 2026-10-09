export async function notifyTeamMessagePosted(payload: {
  messageId: string;
  excludedUsernames: string[];
  includedUsernames?: string[];
}): Promise<{ sent: number; failed: number; warning?: string; skipped?: unknown[] }> {
  const res = await fetch('/api/messages/notify-post', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messageId: payload.messageId,
      excludedUsernames: payload.excludedUsernames.map((u) => u.trim().toLowerCase()).filter(Boolean),
      ...(payload.includedUsernames?.length
        ? {
            includedUsernames: payload.includedUsernames
              .map((u) => u.trim().toLowerCase())
              .filter(Boolean),
          }
        : {}),
    }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Could not send notifications.');
  }

  return (await res.json()) as {
    sent: number;
    failed: number;
    warning?: string;
    skipped?: unknown[];
  };
}

const NOTIFY_MESSAGE_RETRY_MS = 400;

export async function notifyTeamMessagePostedWithRetry(
  payload: Parameters<typeof notifyTeamMessagePosted>[0],
  maxAttempts = 4
): Promise<{ sent: number; failed: number; warning?: string; skipped?: unknown[] }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await notifyTeamMessagePosted(payload);
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : '';
      const retryable =
        /not found|404/i.test(message) && attempt < maxAttempts - 1;
      if (!retryable) throw err;
      await new Promise((r) => window.setTimeout(r, NOTIFY_MESSAGE_RETRY_MS));
    }
  }
  throw lastError;
}
