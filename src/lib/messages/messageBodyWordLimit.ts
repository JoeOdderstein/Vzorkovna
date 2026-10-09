import { messageBodyToPlainText } from './messageRichText';

/** @deprecated Feed uses AI summary instead of word truncation. */
export const MESSAGE_FEED_WORD_LIMIT = 150;

export const MESSAGE_FEED_SUMMARY_WORD_LIMIT = 50;

export function countMessageBodyWords(body: string): number {
  const plain = messageBodyToPlainText(body);
  if (!plain) return 0;
  return plain.split(/\s+/).filter(Boolean).length;
}

export function clampSummaryWords(text: string, maxWords: number): string {
  const trimmed = text.trim();
  if (!trimmed || maxWords <= 0) return '';
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return trimmed;
  return `${words.slice(0, maxWords).join(' ')}…`;
}

export function truncatePlainTextToWords(text: string, maxWords: number): string {
  const trimmed = text.trim();
  if (!trimmed || maxWords <= 0) return text;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(' ')}…`;
}

function removeFollowingContent(root: Node, after: Node): void {
  let cur: Node | null = after;
  while (cur && cur !== root) {
    let sibling = cur.nextSibling;
    while (sibling) {
      const next = sibling.nextSibling;
      sibling.remove();
      sibling = next;
    }
    cur = cur.parentNode;
  }
}

function truncateTextNodeToWordBudget(text: string, budget: number): string {
  if (budget <= 0) return '…';
  const re = /\S+/g;
  let match: RegExpExecArray | null;
  let count = 0;
  let endIndex = 0;
  while ((match = re.exec(text)) !== null) {
    count += 1;
    endIndex = match.index + match[0].length;
    if (count >= budget) break;
  }
  if (count < budget) return text;
  const sliced = text.slice(0, endIndex).replace(/\s+$/, '');
  return `${sliced}…`;
}

/** Truncate rich message HTML after `maxWords` text words (images after the cut are omitted). */
export function truncateMessageHtmlToWordLimit(html: string, maxWords: number): string {
  if (typeof document === 'undefined' || maxWords <= 0) return html;

  const div = document.createElement('div');
  div.innerHTML = html;

  let wordCount = 0;
  const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
  let textNode: Text | null = walker.nextNode() as Text | null;

  while (textNode) {
    const value = textNode.textContent ?? '';
    const wordsInNode = (value.match(/\S+/g) ?? []).length;

    if (wordCount + wordsInNode <= maxWords) {
      wordCount += wordsInNode;
      textNode = walker.nextNode() as Text | null;
      continue;
    }

    const budget = maxWords - wordCount;
    textNode.textContent = truncateTextNodeToWordBudget(value, budget);
    removeFollowingContent(div, textNode);
    return div.innerHTML;
  }

  return html;
}
