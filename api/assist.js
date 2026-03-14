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
    const { nativeText, nativeLang } = req.body || {};

    if (!nativeText || !nativeLang) {
      return res.status(400).json({ error: 'Please provide nativeText and nativeLang.' });
    }

    if (nativeText.length > 500) {
      return res.status(400).json({ error: 'Text too long. Please keep it under 500 characters.' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a friendly English tutor helping a ${nativeLang}-speaking student express their thoughts in English.

The student wants to say this in English (written in ${nativeLang}):
"${nativeText}"

Provide:
1. A natural English translation of what they want to say
2. A brief, simple explanation of the key grammar or vocabulary used (1-2 sentences)
3. 2-3 key words/phrases from the translation that are worth learning

IMPORTANT: You must respond with valid JSON only, no markdown, no code fences.

{
  "english": "The natural English sentence(s)",
  "explanation": "Brief explanation of grammar/vocab used",
  "keyWords": [
    { "word": "key word or phrase", "meaning": "simple explanation in English" }
  ]
}

Guidelines:
- Use natural, everyday English (not overly formal or academic)
- Keep the explanation encouraging and simple
- If there are multiple ways to say it, pick the most natural one`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { temperature: 0.7 },
    });

    let text = response.text ?? '';
    text = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();

    const result = JSON.parse(text);

    if (!result.english) {
      throw new Error('Incomplete response');
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Assist API error:', err);
    return res.status(500).json({ error: `Translation failed: ${err.message || 'Unknown error'}` });
  }
}
