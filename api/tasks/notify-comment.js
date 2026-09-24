import { handleNotifyComment } from '../_lib/notifyComment.js';

export default async function handler(req, res) {
  try {
    return await handleNotifyComment(req, res);
  } catch (err) {
    console.error('Notify comment error:', err);
    return res.status(500).json({ error: 'Could not send comment notification' });
  }
}
