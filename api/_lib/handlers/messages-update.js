import { getTokenFromRequest, isAdminUsername, verifySessionToken } from '../auth.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

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

function usernamesMatch(stored, actor) {
  return (
    String(stored ?? '')
      .trim()
      .toLowerCase() ===
    String(actor ?? '')
      .trim()
      .toLowerCase()
  );
}

export default async function handler(req, res) {
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

  const actor = typeof claims.username === 'string' ? claims.username.trim() : '';
  if (!actor) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = readRequestBody(req);
  const messageId = typeof body.messageId === 'string' ? body.messageId.trim() : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const messageBody = typeof body.body === 'string' ? body.body : '';
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';

  if (!messageId) {
    return res.status(400).json({ error: 'messageId is required' });
  }
  if (!title) {
    return res.status(400).json({ error: 'Message title is required.' });
  }
  if (!String(messageBody).trim()) {
    return res.status(400).json({ error: 'Message cannot be empty.' });
  }
  if (!projectId) {
    return res.status(400).json({ error: 'Choose a project for this message.' });
  }
  if (!category) {
    return res.status(400).json({ error: 'Choose a category for this message.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(503).json({ error: 'Server database is not configured.' });
  }

  try {
    const { data: row, error: fetchError } = await supabase
      .from('team_messages')
      .select('id, author_username')
      .eq('id', messageId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!row) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    const isAdmin = isAdminUsername(actor);
    if (!isAdmin && !usernamesMatch(row.author_username, actor)) {
      return res.status(403).json({ error: 'You can only edit your own messages.' });
    }

    const basePayload = {
      title,
      body: messageBody,
      project_id: projectId,
      category,
    };

    let updatePayload = { ...basePayload, feed_summary: null };
    let { data: updated, error: updateError } = await supabase
      .from('team_messages')
      .update(updatePayload)
      .eq('id', messageId)
      .select('*')
      .maybeSingle();

    if (updateError && /feed_summary|column/i.test(updateError.message)) {
      ({ data: updated, error: updateError } = await supabase
        .from('team_messages')
        .update(basePayload)
        .eq('id', messageId)
        .select('*')
        .maybeSingle());
    }

    if (updateError) throw updateError;
    if (!updated) {
      return res.status(409).json({ error: 'Message could not be saved.' });
    }

    return res.status(200).json({ ok: true, message: updated });
  } catch (err) {
    console.error('Update team message API error:', err);
    const detail = err instanceof Error ? err.message : String(err);
    if (/title|project_id|category|column/i.test(detail)) {
      return res.status(500).json({
        error:
          'Messages need title and project fields. Run supabase/migrations/029_team_message_title_project.sql in Supabase.',
      });
    }
    return res.status(500).json({ error: 'Could not save message.' });
  }
}
