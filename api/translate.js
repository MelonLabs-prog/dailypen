import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfiguration: missing API key' });
  }

  try {
    const { text, targetLang } = req.body || {};

    if (!text || !targetLang) {
      return res.status(400).json({ error: 'Please provide text and targetLang.' });
    }

    if (text.length > 1000) {
      return res.status(400).json({ error: 'Text too long.' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Translate the following English text into ${targetLang}. Return ONLY the translation, nothing else. Do not add explanations or notes.

"${text}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { temperature: 0.3 },
    });

    const translation = (response.text ?? '').trim().replace(/^["']|["']$/g, '');

    return res.status(200).json({ translation });
  } catch (err) {
    console.error('Translate API error:', err);
    return res.status(500).json({ error: `Translation failed: ${err.message || 'Unknown error'}` });
  }
}
