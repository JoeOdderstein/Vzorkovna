const MAX_SOURCE_CHARS = 12000;
const MAX_SUMMARY_WORDS = 50;

function readRequestBody(req) {
  if (req.body == null) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}');
    } catch {
      return {};
    }
  }
  return req.body;
}

export function clampSummaryWords(text, maxWords = MAX_SUMMARY_WORDS) {
  const words = String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ')}…`;
}

function stripHtmlToPlain(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function buildUserPrompt({ title, bodyPlain, truncated }) {
  const titleLine = title
    ? `Message title (already shown in the app — do not repeat in your summary): ${title}\n\n`
    : '';

  const truncationNote = truncated
    ? '(Note: the message body was trimmed for length; summarize all of the text below.)\n\n'
    : '';

  return `${titleLine}${truncationNote}Message body:

${bodyPlain}

---

Write a summary of the message body in at most 50 words. Use 1–3 complete, easy-to-read sentences. Explain what the whole message is about (read it start to finish). Do not copy the opening sentence verbatim. Do not include the title.`;
}

async function callOpenAI({ title, bodyPlain, truncated }) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { error: 'missing_api_key', message: 'OpenAI is not configured (OPENAI_API_KEY).' };
  }

  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';

  let response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content:
              'You summarize internal team chat messages. Output only the summary text—no labels, quotes, or markdown.',
          },
          {
            role: 'user',
            content: buildUserPrompt({ title, bodyPlain, truncated }),
          },
        ],
      }),
    });
  } catch (err) {
    console.error('OpenAI network error (feed summary):', err);
    return { error: 'openai_network', message: 'Could not reach OpenAI.' };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('OpenAI feed summary failed:', response.status, detail.slice(0, 500));
    return { error: 'openai_failed', message: 'OpenAI could not summarize this message.' };
  }

  const payload = await response.json();
  const raw = payload?.choices?.[0]?.message?.content;
  const summary = clampSummaryWords(String(raw ?? '').trim());
  if (!summary) {
    return { error: 'openai_empty', message: 'OpenAI returned an empty summary.' };
  }

  return { summary };
}

export async function generateMessageFeedSummary({ title, bodyHtml }) {
  const bodyPlain = stripHtmlToPlain(bodyHtml);
  if (!bodyPlain && !String(title ?? '').trim()) {
    return { error: 'empty', message: 'Message has no text to summarize.' };
  }

  const truncated = bodyPlain.length > MAX_SOURCE_CHARS;
  const clippedPlain = truncated
    ? `${bodyPlain.slice(0, MAX_SOURCE_CHARS)}…`
    : bodyPlain;

  const openai = await callOpenAI({
    title: String(title ?? '').trim(),
    bodyPlain: clippedPlain,
    truncated,
  });

  if (openai.error) {
    return {
      error: openai.error,
      message: openai.message ?? 'Could not generate summary.',
    };
  }

  return { summary: openai.summary, generatedBy: 'openai' };
}

export { readRequestBody, stripHtmlToPlain, MAX_SUMMARY_WORDS };
