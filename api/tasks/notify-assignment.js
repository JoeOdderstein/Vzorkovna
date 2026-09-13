import { handleNotifyAssignment } from '../_lib/notifyAssignment.js';

export default async function handler(req, res) {
  try {
    return await handleNotifyAssignment(req, res);
  } catch (err) {
    console.error('Notify assignment error:', err);
    return res.status(500).json({ error: 'Could not send assignment notification' });
  }
}
