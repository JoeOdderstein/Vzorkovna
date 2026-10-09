import { getTokenFromRequest, verifySessionToken } from '../auth.js';
import { generateMessageFeedSummary, readRequestBody } from '../parseMessageFeedSummary.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await verifySessionToken(token);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = readRequestBody(req);
  const messageId = typeof body.messageId === 'string' ? body.messageId.trim() : '';
  const force = body.force === true;

  if (!messageId) {
    return res.status(400).json({ error: 'messageId is required' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' });
  }

  const { data: message, error: loadError } = await supabase
    .from('team_messages')
    .select('id, title, body, feed_summary')
    .eq('id', messageId)
    .maybeSingle();

  if (loadError || !message) {
    return res.status(404).json({ error: 'Message not found' });
  }

  const existing = String(message.feed_summary ?? '').trim();
  if (existing && !force) {
    return res.status(200).json({ summary: existing, cached: true, generatedBy: 'openai' });
  }

  const result = await generateMessageFeedSummary({
    title: message.title,
    bodyHtml: message.body,
  });

  if (result.error) {
    const status = result.error === 'missing_api_key' ? 503 : 502;
    return res.status(status).json({
      error: result.message ?? 'Could not generate summary.',
      code: result.error,
    });
  }

  if (!result.summary) {
    return res.status(422).json({ error: 'Could not generate summary.' });
  }

  const { error: updateError } = await supabase
    .from('team_messages')
    .update({ feed_summary: result.summary })
    .eq('id', messageId);

  if (updateError) {
    console.error('Feed summary save failed:', updateError);
    return res.status(200).json({
      summary: result.summary,
      cached: false,
      saved: false,
      generatedBy: 'openai',
      warning: 'save_failed',
    });
  }

  return res.status(200).json({
    summary: result.summary,
    cached: false,
    saved: true,
    generatedBy: 'openai',
  });
}
