import { messageBodyToPlainText } from './messageRichText';
import { clampSummaryWords, MESSAGE_FEED_SUMMARY_WORD_LIMIT } from './messageBodyWordLimit';
import { isLocalTaskboardMode } from '../taskboard/taskService';

/** Plain excerpt when AI is unavailable (local dev only — readable, not a summary). */
export function buildLocalFeedSummary(body: string): string {
  const plain = messageBodyToPlainText(body).trim();
  if (!plain) return '';
  return clampSummaryWords(plain, MESSAGE_FEED_SUMMARY_WORD_LIMIT);
}

export async function fetchMessageFeedSummary(
  messageId: string,
  options?: { force?: boolean }
): Promise<string> {
  if (isLocalTaskboardMode()) {
    return '';
  }

  const res = await fetch('/api/messages/feed-summary', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messageId,
      force: options?.force === true,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as { summary?: string; error?: string };

  if (!res.ok) {
    throw new Error(data.error ?? 'Could not load message summary.');
  }

  return String(data.summary ?? '').trim();
}
