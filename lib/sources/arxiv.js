/**
 * arXiv API Source Fetcher
 */

import { parseStringPromise } from 'xml2js';

const ARXIV_API_BASE = 'http://export.arxiv.org/api/query';

export async function getRecentPapers(category = 'cs.AI', count = 2) {
  const url = new URL(ARXIV_API_BASE);
  url.searchParams.set('search_query', `cat:${category}`);
  url.searchParams.set('start', '0');
  url.searchParams.set('max_results', count.toString());
  url.searchParams.set('sortBy', 'submittedDate');
  url.searchParams.set('sortOrder', 'descending');

  try {
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`arXiv API error: ${response.status}`);

    const xmlText = await response.text();
    const result = await parseStringPromise(xmlText);
    const entries = result.feed.entry || [];

    return entries.map((entry, index) => ({
      id: `arxiv-${category}-${index}`,
      title: entry.title?.[0]?.replace(/\s+/g, ' ').trim() || 'Untitled',
      url: entry.id?.[0] || '',
      excerpt: (entry.summary?.[0]?.replace(/\s+/g, ' ').trim() || '').substring(0, 300),
      source: 'arXiv',
    }));
  } catch (error) {
    console.error(`Failed to fetch arXiv papers for ${category}:`, error.message);
    return [];
  }
}
