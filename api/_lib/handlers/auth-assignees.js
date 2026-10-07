import { handleListAssignees } from '../members.js';

export default async function handler(req, res) {
  try {
    return await handleListAssignees(req, res);
  } catch (err) {
    console.error('Assignees API error:', err);
    return res.status(500).json({ error: 'Could not load assignees' });
  }
}
