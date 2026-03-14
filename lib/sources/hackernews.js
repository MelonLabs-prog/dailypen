/**
 * Hacker News API Source Fetcher
 * Fetches top stories from Hacker News
 */

const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0';

async function fetchStory(id) {
  const response = await fetch(`${HN_API_BASE}/item/${id}.json`);
  if (!response.ok) throw new Error(`Failed to fetch story ${id}: ${response.status}`);
  return response.json();
}

export async function getTopStories(count = 3) {
  const response = await fetch(`${HN_API_BASE}/topstories.json`);
  if (!response.ok) throw new Error(`Failed to fetch top stories: ${response.status}`);

  const storyIds = await response.json();
  const topIds = storyIds.slice(0, count);
  const stories = await Promise.all(topIds.map(fetchStory));

  return stories
    .filter(story => story && story.title)
    .map(story => ({
      id: `hn-${story.id}`,
      title: story.title,
      url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
      source: 'Hacker News',
    }));
}
