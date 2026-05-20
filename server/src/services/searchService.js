import { logger } from '../utils/logger.js';

const TAVILY_API_URL = 'https://api.tavily.com/search';
const MAX_RESULTS = 5;

export class SearchService {
  constructor() {
    this.apiKey = process.env.TAVILY_API_KEY;
    this.enabled = Boolean(this.apiKey);
    if (!this.enabled) {
      logger.warn('SearchService', 'TAVILY_API_KEY not set. Web search disabled.');
    }
  }

  /**
   * Search the web and return a formatted context string for LLM injection.
   * Returns null if disabled or on failure (caller falls back to LLM-only).
   */
  async search(query) {
    if (!this.enabled) return null;

    try {
      const res = await fetch(TAVILY_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.apiKey,
          query,
          search_depth: 'basic',
          max_results: MAX_RESULTS,
          include_answer: true,
        }),
      });

      if (!res.ok) {
        logger.warn('SearchService', `Tavily returned ${res.status}`);
        return null;
      }

      const data = await res.json();

      // Build a compact context block for the LLM
      const snippets = (data.results || [])
        .map((r, i) => `[${i + 1}] ${r.title}\n${r.content?.substring(0, 300)}`)
        .join('\n\n');

      const context = data.answer
        ? `Web Answer: ${data.answer}\n\nSources:\n${snippets}`
        : `Web Sources:\n${snippets}`;

      logger.info('SearchService', `Search complete`, { query, results: data.results?.length });
      return context;
    } catch (err) {
      logger.error('SearchService', 'Search failed', { error: err.message });
      return null;
    }
  }
}

export const searchService = new SearchService();
