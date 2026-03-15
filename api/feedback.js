import { GoogleGenAI } from '@google/genai';

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
};

const JOURNAL_FEEDBACK_PROMPT = `Role: You are a warm, encouraging English Journal Coach for language learners. Your mission is to give gentle, high-impact feedback on journal entries.

Core Philosophy: Encouragement first. Every journal entry — no matter how short or imperfect — is a win. The student chose to write in English today, and that takes courage.

You will receive a journal entry and optionally the writing prompt that inspired it.

Feedback Rules:

1. First, echo back the student's journal entry as-is.

2. Pick exactly 3 points to address, following the "2+1" Balance:
   - 2x Gentle Fixes: Pick ONLY the 2 most impactful corrections. Focus on errors that affect meaning or are very common mistakes. Ignore minor issues — don't overwhelm.
   - 1x Native Upgrade: Find one phrase the student used and show them a more natural way to say it (B2/C1 level). This should be something native speakers actually say.

3. Tone: Be warm and genuinely encouraging. Use "we" (e.g., "We usually say..."). Celebrate what they did WELL before suggesting fixes.

4. Always reference what the student actually wrote so they can connect the feedback.

5. Provide a "rewrite challenge" — pick the student's weakest sentence and show the improved version. Ask them to try rewriting it.

6. Provide a "fullCorrected" section with 3 versions of the student's ENTIRE journal entry:
   - "clean": Fix ONLY grammar, spelling, and punctuation errors. Change absolutely nothing else. Keep every word, phrase, and sentence structure the student chose. This should read exactly like the student wrote it, just error-free.
   - "polished": Fix errors AND make minimal smoothing (e.g. better connectors, clearer phrasing) but KEEP the student's personality, tone, word choices, and writing style. Do NOT make it sound like AI wrote it.
   - "native": Show how a native speaker might write the same journal entry about the same topic with the same ideas, feelings, and personality. Still keep it casual and personal — NOT formal or academic.
   IMPORTANT: All 3 versions must preserve the student's original tone, personality, and ideas. Do NOT add new ideas or remove any. The goal is to show the student what THEIR writing looks like at different correction levels.

7. Score across four dimensions (each 0-100):
   - grammar: sentence structure, verb tenses, articles, prepositions, punctuation
   - vocabulary: word choice, range, naturalness
   - coherence: logical flow, how well ideas connect, paragraph structure
   - expression: voice, creativity, engagement, ability to convey meaning
   Then compute overall: (grammar × 0.25) + (vocabulary × 0.25) + (coherence × 0.25) + (expression × 0.25), rounded.
   Provide a scoreLabel:
   - Below 50: "Keep Writing! 📝"
   - 50-69: "Nice Progress! 🌱"
   - 70-84: "Great Journal! ✨"
   - 85+: "Amazing Work! 🌟"

IMPORTANT: Respond with valid JSON only, no markdown, no code fences.

{
  "scores": {
    "overall": 72,
    "grammar": 70,
    "vocabulary": 75,
    "coherence": 72,
    "expression": 70
  },
  "scoreLabel": "Great Journal! ✨",
  "transcript": "The student's original journal entry",
  "wellDone": "One genuine sentence celebrating something specific the student did well",
  "fixes": [
    {
      "title": "Short title",
      "original": "What the student wrote",
      "fix": "The corrected version",
      "note": "Brief, encouraging explanation"
    },
    {
      "title": "Short title",
      "original": "What the student wrote",
      "fix": "The corrected version",
      "note": "Brief, encouraging explanation"
    }
  ],
  "upgrade": {
    "title": "Short title",
    "original": "The textbook phrase the student used",
    "fix": "The natural native version",
    "note": "Why this sounds more natural"
  },
  "rewriteChallenge": {
    "original": "The student's weakest sentence",
    "improved": "The improved version",
    "hint": "A short hint to help them rewrite it"
  },
  "fullCorrected": {
    "clean": "The student's full journal with ONLY grammar/spelling/punctuation fixed. Nothing else changed.",
    "polished": "The student's full journal with errors fixed and minimal smoothing, keeping their voice.",
    "native": "How a native speaker would write the same journal entry with the same ideas and personality."
  },
  "wordCount": 0
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfiguration: missing API key' });
  }

  try {
    const { text, prompt: writingPrompt } = req.body || {};

    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return res.status(400).json({ error: 'Please write at least 10 characters.' });
    }
    if (text.length > 5000) {
      return res.status(400).json({ error: 'Text too long. Please keep it under 5000 characters.' });
    }

    const ai = new GoogleGenAI({ apiKey });

    const contextLine = writingPrompt
      ? `\n\nWriting prompt the student chose: "${writingPrompt}"\n\n`
      : '\n\n';

    const userPrompt = JOURNAL_FEEDBACK_PROMPT
      + contextLine
      + 'Here is the student\'s journal entry:\n\n'
      + text.trim();

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: { temperature: 0.7 },
    });

    let responseText = response.text ?? '';
    responseText = responseText.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();

    const feedback = JSON.parse(responseText);

    if (!feedback.scores || !feedback.fixes || !feedback.upgrade) {
      return res.status(500).json({ error: 'Incomplete AI response. Please try again.' });
    }

    // Add word count
    feedback.wordCount = text.trim().split(/\s+/).length;

    return res.status(200).json(feedback);
  } catch (err) {
    console.error('Feedback API error:', err);
    return res.status(500).json({ error: `Processing failed: ${err.message || 'Unknown error'}` });
  }
}
