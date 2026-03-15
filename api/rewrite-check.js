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
    const { original, improved, rewrite } = req.body || {};

    if (!original || !rewrite) {
      return res.status(400).json({ error: 'Missing original or rewrite text.' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a grammar and spelling checker for an English learner's rewrite attempt.

The student's original sentence had an error. Here is the corrected reference:
Reference (correct version): "${improved}"

The student tried to rewrite it. Here is their attempt:
Student's rewrite: "${rewrite}"

Your ONLY job is to check:
1. Does the student's rewrite fix the original grammar/spelling error?
2. Are there any NEW grammar or spelling mistakes in their rewrite?

Do NOT check style, word choice, or suggest alternative phrasings. Do NOT suggest rewording. Only check grammar and spelling correctness against the reference.

IMPORTANT: Respond with valid JSON only, no markdown, no code fences.

{
  "rating": "great" | "good" | "try_again",
  "feedback": "1-2 sentence feedback about grammar/spelling only. Be encouraging.",
  "tip": "If there is a grammar/spelling issue, point it out briefly. Otherwise null."
}

Rating guide:
- "great": grammar and spelling are correct (doesn't need to match reference word-for-word)
- "good": mostly correct but has a minor grammar/spelling issue
- "try_again": still has the original error or introduced new grammar/spelling mistakes`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { temperature: 0.5 },
    });

    let text = response.text ?? '';
    text = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();

    const result = JSON.parse(text);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Rewrite check error:', err);
    return res.status(500).json({ error: 'Could not check rewrite. Please try again.' });
  }
}
