import { handleTranslate } from '../translate.js';

export default async function handler(req, res) {
  try {
    return await handleTranslate(req, res);
  } catch (err) {
    console.error('Translate API error:', err);
    return res.status(500).json({ error: 'Translation failed' });
  }
}
