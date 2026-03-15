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

    const prompt = `You are a friendly English tutor. A student was given a rewrite challenge.

Original sentence (with errors): "${original}"
Suggested improvement: "${improved}"
Student's rewrite attempt: "${rewrite}"

Give brief, encouraging feedback on their rewrite. Compare it to the suggested improvement.

IMPORTANT: Respond with valid JSON only, no markdown, no code fences.

{
  "rating": "great" | "good" | "try_again",
  "feedback": "1-2 sentence encouraging feedback. Be specific about what they got right or what to adjust.",
  "tip": "Optional short tip if rating is not 'great', otherwise null"
}

Rating guide:
- "great": rewrite captures the correction well (doesn't need to be word-for-word identical)
- "good": mostly correct but missed a small detail
- "try_again": still has the original error or introduced new issues`;

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
