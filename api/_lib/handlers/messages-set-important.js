import { isAdminUsername } from '../auth.js';
import { requireMessageAreaAccess } from '../messageAccess.js';
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

  const auth = await requireMessageAreaAccess(req, res);
  if (!auth) return;

  const actor = auth.username.trim();
  const body = readRequestBody(req);
  const messageId = typeof body.messageId === 'string' ? body.messageId.trim() : '';
  const isImportant = Boolean(body.isImportant);

  if (!messageId) {
    return res.status(400).json({ error: 'messageId is required' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(503).json({ error: 'Server database is not configured.' });
  }

  try {
    const { data: row, error: fetchError } = await supabase
      .from('team_messages')
      .select('id, author_username, thread_root_id')
      .eq('id', messageId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!row) {
      return res.status(404).json({ error: 'Message not found.' });
    }
    if (row.thread_root_id) {
      return res.status(400).json({ error: 'Only top-level messages can be marked important.' });
    }

    const isAdmin = isAdminUsername(actor);
    if (!isAdmin && !usernamesMatch(row.author_username, actor)) {
      return res.status(403).json({ error: 'You can only update your own messages.' });
    }

    let { data: updated, error: updateError } = await supabase
      .from('team_messages')
      .update({ is_important: isImportant })
      .eq('id', messageId)
      .select('*')
      .maybeSingle();

    if (updateError && /is_important|column/i.test(updateError.message)) {
      return res.status(500).json({
        error:
          'Important flag is not available yet. Run supabase/migrations/050_team_message_important.sql in Supabase.',
      });
    }

    if (updateError) throw updateError;
    if (!updated) {
      return res.status(409).json({ error: 'Message could not be saved.' });
    }

    return res.status(200).json({ ok: true, message: updated });
  } catch (err) {
    console.error('Set team message important API error:', err);
    return res.status(500).json({ error: 'Could not update message.' });
  }
}
