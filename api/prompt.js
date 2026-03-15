import { GoogleGenAI } from '@google/genai';
import { getTopStories } from '../lib/sources/hackernews.js';
import { getLatestArticles } from '../lib/sources/guardian.js';

// Simple in-memory cache (one day)
let cache = { date: null, data: null };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfiguration: missing API key' });
  }

  const today = new Date().toISOString().split('T')[0];
  const refresh = req.query?.refresh === '1';

  // Return cached if same day and not a refresh request
  if (!refresh && cache.date === today && cache.data) {
    return res.status(200).json(cache.data);
  }

  try {
    // Fetch trending articles from sources (best-effort, don't fail if some sources are down)
    const articles = [];

    try {
      const hn = await getTopStories(3);
      articles.push(...hn);
    } catch (e) {
      console.error('HN fetch failed:', e.message);
    }

    const guardianKey = process.env.GUARDIAN_API_KEY;
    if (guardianKey) {
      try {
        const guardian = await getLatestArticles(guardianKey, 'world', 2);
        articles.push(...guardian);
      } catch (e) {
        console.error('Guardian fetch failed:', e.message);
      }
    }

    // Build prompt for Gemini to generate all daily prompts
    const articleContext = articles.length > 0
      ? articles.slice(0, 5).map(a => `- "${a.title}" (${a.source})${a.excerpt ? ': ' + a.excerpt.substring(0, 150) : ''}`).join('\n')
      : '';

    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are a creative writing prompt generator for English learners (B1-B2 level).
Today's date is ${today}.

${articleContext ? `Here are today's trending articles:\n${articleContext}\n` : ''}
Generate journal writing prompts in these categories. For EACH prompt, include 3-5 suggested vocabulary words/phrases the writer could use.

IMPORTANT: You must respond with valid JSON only, no markdown, no code fences.

{
  "reflect": [
    {
      "prompt": "A self-discovery question about feelings, experiences, or personal growth",
      "vocab": ["word1", "phrase2", "word3"]
    }
  ],
  "world": [
    {
      "prompt": "A simplified trending topic, ending with a question",
      "vocab": ["word1", "phrase2", "word3"],
      "source": "Source name"
    },
    {
      "prompt": "On this day in [year], [historical event simplified to B1-B2]. What do you think about this?",
      "vocab": ["word1", "phrase2", "word3"],
      "source": "Today in History"
    }
  ],
  "random": [
    {
      "prompt": "A fun, creative, or unexpected prompt",
      "vocab": ["word1", "phrase2", "word3"]
    }
  ]
}

Guidelines:
- Reflect prompts: warm, personal, encourage self-expression (e.g. "What made you smile today?", "Describe a moment you felt proud of yourself recently")
- World prompts: MUST include at least 1 "Today in History" prompt about a real event that happened on today's date (${today}). The rest should be based on the trending articles above, simplified to B1-B2 level. Always end with an opinion question.
- Random prompts: creative, fun, thought-provoking
- Vocab words should be B2-C1 level — challenging but useful. Include a mix of adjectives, verbs, and phrases.
- Generate exactly 3 reflect, 3 world (at least 1 must be "Today in History"), and 2 random prompts.
- Be creative and varied — avoid generic prompts.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
      config: { temperature: 0.9 },
    });

    let text = response.text ?? '';
    text = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();

    const prompts = JSON.parse(text);

    // Validate structure
    if (!prompts.reflect || !prompts.world || !prompts.random) {
      throw new Error('Incomplete prompt response');
    }

    // Cache for the day
    cache = { date: today, data: prompts };

    return res.status(200).json(prompts);
  } catch (err) {
    console.error('Prompt API error:', err);
    // Return fallback prompts if AI fails
    const fallback = {
      reflect: [
        { prompt: 'What is something new you learned this week? How did it make you feel?', vocab: ['fascinating', 'discover', 'perspective', 'realize'] },
        { prompt: 'Describe a person who has influenced your life. What did they teach you?', vocab: ['inspire', 'grateful', 'wisdom', 'role model'] },
      ],
      world: [
        { prompt: 'Many people around the world are discussing how technology changes the way we communicate. Do you think technology brings people closer together or pushes them apart? Why?', vocab: ['connection', 'interact', 'social media', 'meaningful'], source: 'General' },
        { prompt: 'Today, think about a news story you heard recently. What happened and what is your opinion about it?', vocab: ['headline', 'significant', 'impact', 'debate'], source: 'General' },
      ],
      random: [
        { prompt: 'If you could wake up tomorrow with one new skill or ability, what would it be and why?', vocab: ['master', 'ambitious', 'transform', 'passion'] },
      ],
    };
    return res.status(200).json(fallback);
  }
}
