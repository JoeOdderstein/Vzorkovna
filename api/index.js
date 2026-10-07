/**
 * Single Serverless Function for all /api/* routes (Vercel Hobby limit).
 * Nested paths are rewritten here via vercel.json; req.url keeps the original path.
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
