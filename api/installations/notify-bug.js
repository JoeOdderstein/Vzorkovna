import { handleNotifyBugReport } from '../_lib/notifyBugReport.js';

export default async function handler(req, res) {
  try {
    return await handleNotifyBugReport(req, res);
  } catch (err) {
    console.error('Notify bug API error:', err);
    return res.status(500).json({ error: 'Could not send bug notifications' });
  }
}
