/**
 * The Guardian API Source Fetcher
 */

const GUARDIAN_API_BASE = 'https://content.guardianapis.com';

export async function getLatestArticles(apiKey, section = 'world', count = 3) {
  const url = new URL(`${GUARDIAN_API_BASE}/${section}`);
  url.searchParams.set('api-key', apiKey);
  url.searchParams.set('page-size', count.toString());
  url.searchParams.set('show-fields', 'trailText,headline');
  url.searchParams.set('order-by', 'newest');

  try {
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Guardian API error: ${response.status}`);

    const data = await response.json();
    if (data.response.status !== 'ok') throw new Error(`Guardian API returned: ${data.response.status}`);

    return data.response.results.map((article, index) => ({
      id: `guardian-${section}-${index}`,
      title: article.fields?.headline || article.webTitle,
      url: article.webUrl,
      excerpt: article.fields?.trailText || '',
      source: 'The Guardian',
    }));
  } catch (error) {
    console.error(`Failed to fetch Guardian articles for ${section}:`, error.message);
    return [];
  }
}
