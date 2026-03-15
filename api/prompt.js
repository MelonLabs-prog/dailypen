import { GoogleGenAI } from '@google/genai';
import { getTopStories } from '../lib/sources/hackernews.js';
import { getLatestArticles } from '../lib/sources/guardian.js';

// Simple in-memory cache (one day)
let cache = { date: null, data: null };

// Rotating theme pools — cycled by day-of-year to ensure daily variety
const reflectThemes = [
  ['childhood memories', 'a skill you are proud of', 'your relationship with food'],
  ['a place that feels like home', 'something that scares you', 'a habit you want to change'],
  ['your happiest moment this year', 'a friendship that matters', 'what success means to you'],
  ['a mistake that taught you something', 'your morning routine', 'a song that changed your mood'],
  ['a stranger who was kind to you', 'what makes you feel confident', 'your favourite season and why'],
  ['a book or movie that changed you', 'something you forgave', 'a goal for next month'],
  ['your relationship with technology', 'a tradition you love', 'what you do when you feel lonely'],
  ['a compliment you will never forget', 'your biggest fear about the future', 'a small thing that makes your day'],
  ['a difficult decision you made', 'what home sounds like', 'a language barrier experience'],
  ['something you lost and how you felt', 'an act of kindness you did', 'what motivates you to learn English'],
];

const randomThemes = [
  ['time travel to the past', 'a superpower you would choose'],
  ['a letter to your future self', 'life on another planet'],
  ['a day without technology', 'your dream job as a child'],
  ['if animals could talk', 'designing your perfect city'],
  ['a mystery you want to solve', 'the last person on Earth'],
  ['inventing a new holiday', 'switching lives with someone for a day'],
  ['a world where everyone is honest', 'your life as a movie plot'],
  ['a message in a bottle', 'waking up in a different country'],
  ['a conversation with your pet', 'the weirdest dream you ever had'],
  ['living in a different century', 'a talent show with a hidden skill'],
];

function getTodayThemes(date) {
  const dayOfYear = Math.floor((new Date(date) - new Date(date.substring(0, 4) + '-01-01')) / 86400000);
  const reflectIdx = dayOfYear % reflectThemes.length;
  const randomIdx = dayOfYear % randomThemes.length;
  return {
    reflect: reflectThemes[reflectIdx],
    random: randomThemes[randomIdx],
  };
}

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

    const themes = getTodayThemes(today);

    const systemPrompt = `You are a creative writing prompt generator for English learners (B1-B2 level).
Today's date is ${today}.

${articleContext ? `Here are today's trending articles:\n${articleContext}\n` : ''}
Generate journal writing prompts in these categories. For EACH prompt, include 3-5 suggested vocabulary words/phrases the writer could use.

Today's assigned themes (you MUST base your prompts on these specific themes):
- Reflect themes: ${themes.reflect.join(', ')}
- Random themes: ${themes.random.join(', ')}

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
- Reflect prompts: warm, personal, encourage self-expression. Each prompt MUST be about one of today's assigned reflect themes.
- World prompts: MUST include at least 1 "Today in History" prompt about a real event that happened on today's date (${today}). The rest should be based on the trending articles above, simplified to B1-B2 level. Always end with an opinion question.
- Random prompts: creative, fun, thought-provoking. Each prompt MUST be about one of today's assigned random themes.
- Vocab words should be B2-C1 level — challenging but useful. Include a mix of adjectives, verbs, and phrases.
- Generate exactly 3 reflect (one per theme), 3 world (at least 1 must be "Today in History"), and 2 random (one per theme).
- Each prompt must be a unique angle on its assigned theme. Be specific and vivid — avoid generic questions.`;

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
        { prompt: 'Think about a time you stepped out of your comfort zone. What happened and how did you feel?', vocab: ['courage', 'nervous', 'overcome', 'rewarding'] },
      ],
      world: [
        { prompt: 'Many people around the world are discussing how technology changes the way we communicate. Do you think technology brings people closer together or pushes them apart? Why?', vocab: ['connection', 'interact', 'social media', 'meaningful'], source: 'General' },
        { prompt: 'Today, think about a news story you heard recently. What happened and what is your opinion about it?', vocab: ['headline', 'significant', 'impact', 'debate'], source: 'General' },
        { prompt: 'More people are working from home than ever before. Do you think this trend will continue? What are the pros and cons?', vocab: ['remote', 'flexibility', 'isolation', 'productivity'], source: 'General' },
      ],
      random: [
        { prompt: 'If you could wake up tomorrow with one new skill or ability, what would it be and why?', vocab: ['master', 'ambitious', 'transform', 'passion'] },
        { prompt: 'You find a mysterious door in your house that you have never noticed before. What happens when you open it?', vocab: ['curiosity', 'bizarre', 'stumble upon', 'astonishing'] },
      ],
    };
    return res.status(200).json(fallback);
  }
}
