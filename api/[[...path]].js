/**
 * Single Vercel Serverless Function for all /api/* routes (Hobby plan limit).
 * Route modules live in api/_lib/handlers/ (not counted as separate functions).
 */
import { dispatchApi } from './_lib/dispatchApi.js';

export default async function handler(req, res) {
  try {
    return await dispatchApi(req, res);
  } catch (err) {
    console.error('API dispatch error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
