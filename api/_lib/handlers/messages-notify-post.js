import { handleNotifyTeamMessage } from '../notifyTeamMessage.js';

export default async function handler(req, res) {
  try {
    return await handleNotifyTeamMessage(req, res);
  } catch (err) {
    console.error('Notify team message error:', err);
    return res.status(500).json({ error: 'Could not send message notifications' });
  }
}
