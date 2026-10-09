import { getTokenFromRequest, verifySessionToken } from './auth.js';
import { getSupabaseAdmin } from './supabaseAdmin.js';

const MAX_TEXT_LENGTH = 5000;

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

function deeplBaseUrl(apiKey) {
  return String(apiKey).endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';
}

function toDeepLTarget(locale) {
  return locale === 'uk' ? 'UK' : 'EN';
}

function fromDeepLLang(code) {
  const normalized = String(code ?? '').toUpperCase();
  if (normalized === 'UK' || normalized === 'UA') return 'uk';
  return 'en';
}

export async function translateWithDeepL(text, targetLocale) {
  const apiKey = process.env.DEEPL_API_KEY?.trim();
  if (!apiKey) return null;

  const trimmed = String(text ?? '').trim();
  if (!trimmed) {
    return { text: '', detectedLocale: 'en', translated: false };
  }

  const params = new URLSearchParams();
  params.append('text', trimmed.slice(0, MAX_TEXT_LENGTH));
  params.set('target_lang', toDeepLTarget(targetLocale));

  const response = await fetch(deeplBaseUrl(apiKey), {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `DeepL request failed (${response.status})`);
  }

  const payload = await response.json();
  const result = payload?.translations?.[0];
  if (!result?.text) {
    throw new Error('Unexpected translation response');
  }

  const detectedLocale = fromDeepLLang(result.detected_source_language);
  const translated =
    detectedLocale !== targetLocale && String(result.text).trim() !== trimmed;

  return {
    text: String(result.text),
    detectedLocale,
    translated,
  };
}

export async function handleTranslate(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let claims;
  try {
    claims = await verifySessionToken(token);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = readRequestBody(req);
  const text = String(body.text ?? '');
  const target = body.target_lang === 'en' ? 'en' : 'uk';

  if (!text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ error: `text must be at most ${MAX_TEXT_LENGTH} characters` });
  }

  const passthrough = () =>
    res.status(200).json({
      text: text.trim(),
      target_lang: target,
      detected_source_lang: 'en',
      translated: false,
    });

  const username = typeof claims.username === 'string' ? claims.username.trim() : '';
  if (target !== 'uk' || !username) {
    return passthrough();
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('preferred_locale')
      .eq('username', username)
      .maybeSingle();
    if (profile?.preferred_locale !== 'uk') {
      return passthrough();
    }
  } catch (err) {
    console.error('Translate profile check failed:', err);
    return passthrough();
  }

  if (!process.env.DEEPL_API_KEY?.trim()) {
    return res.status(503).json({
      error: 'Translation is not configured. Add DEEPL_API_KEY on the server.',
    });
  }

  try {
    const result = await translateWithDeepL(text, target);
    if (!result) {
      return res.status(503).json({ error: 'Translation is not configured.' });
    }

    return res.status(200).json({
      text: result.text,
      target_lang: target,
      detected_source_lang: result.detectedLocale,
      translated: result.translated,
    });
  } catch (err) {
    console.error('Translate failed:', err);
    return res.status(500).json({
      error: 'Translation failed',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
