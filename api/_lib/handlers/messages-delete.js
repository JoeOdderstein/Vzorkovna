import { getTokenFromRequest, isAdminUsername, verifySessionToken } from '../auth.js';
import { getSupabaseAdmin } from '../supabaseAdmin.js';

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

  const messageId = req.body?.messageId ?? req.body?.id;
  if (!messageId || typeof messageId !== 'string') {
    return res.status(400).json({ error: 'messageId is required' });
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
      return res.status(403).json({ error: 'You can only delete your own messages.' });
    }

    const { data: deleted, error: deleteError } = await supabase
      .from('team_messages')
      .delete()
      .eq('id', messageId)
      .select('id');

    if (deleteError) throw deleteError;
    if (!deleted?.length) {
      return res.status(409).json({ error: 'Message could not be deleted.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Delete team message API error:', err);
    return res.status(500).json({ error: 'Could not delete message.' });
  }
}
