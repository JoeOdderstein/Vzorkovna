export type TranslateTarget = 'en' | 'uk';

export type TranslateResult = {
  text: string;
  translated: boolean;
  detectedSourceLang?: string;
};

const cache = new Map<string, TranslateResult>();

function cacheKey(text: string, target: TranslateTarget) {
  return `${target}\0${text}`;
}

export async function translateText(
  text: string,
  targetLang: TranslateTarget = 'uk'
): Promise<TranslateResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { text: '', translated: false };
  }

  const key = cacheKey(trimmed, targetLang);
  const hit = cache.get(key);
  if (hit) return hit;

  const res = await fetch('/api/translate', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: trimmed, target_lang: targetLang }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      (typeof data.error === 'string' && data.error) ||
      (res.status === 503
        ? 'Translation is not set up yet (server needs DEEPL_API_KEY).'
        : 'Could not translate.');
    throw new Error(message);
  }

  const result: TranslateResult = {
    text: String(data.text ?? trimmed),
    translated: Boolean(data.translated),
    detectedSourceLang:
      typeof data.detected_source_lang === 'string' ? data.detected_source_lang : undefined,
  };

  cache.set(key, result);
  return result;
}

export function clearTranslationCache() {
  cache.clear();
}
