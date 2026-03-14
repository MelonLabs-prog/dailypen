/**
 * RSS Source Fetcher
 * Fetches latest posts from RSS feeds (Substack, blogs, etc.)
 */

import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
});

export async function getLatestPosts(feedInput, count = 2) {
  let feedUrl;
  if (feedInput.startsWith('http')) {
    feedUrl = feedInput.endsWith('/feed') ? feedInput : `${feedInput}/feed`;
  } else if (feedInput.includes('.')) {
    feedUrl = `https://${feedInput}/feed`;
  } else {
    feedUrl = `https://${feedInput}.substack.com/feed`;
  }

  const sourceName = feedInput.replace(/^https?:\/\//, '').replace(/\.substack\.com.*/, '').replace(/\/feed$/, '');

  try {
    const feed = await parser.parseURL(feedUrl);
    return feed.items.slice(0, count).map((item, index) => ({
      id: `rss-${sourceName}-${index}`,
      title: item.title,
      url: item.link,
      excerpt: item.contentSnippet?.substring(0, 300) || '',
      source: feed.title || sourceName,
    }));
  } catch (error) {
    console.error(`Failed to fetch RSS feed for ${sourceName}:`, error.message);
    return [];
  }
}

export async function getPostsFromMultiple(feedInputs, countPerFeed = 2) {
  const allPosts = await Promise.all(
    feedInputs.map(name => getLatestPosts(name, countPerFeed))
  );
  return allPosts.flat();
}
