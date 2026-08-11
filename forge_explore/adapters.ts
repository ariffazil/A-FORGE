/**
 * forge_explore — Adapter Interfaces + Registry
 * ==============================================
 * forge_id: FE-{2026.08.10}-001
 * module:   ADAPTERS (bridge between graph stubs and real tools)
 *
 * The graph nodes (SEARCH, FETCH, EXTRACT_LINKS, FOLLOW) need real tool
 * backends. These adapters provide a dependency-injection layer so the
 * graph can run against real tools OR mock fixtures for testing.
 *
 * ADAPTER INTERFACES:
 *   SearchAdapter  — search the web, return ranked URLs
 *   FetchAdapter   — fetch a URL, return page content
 *   ExtractAdapter — extract links from fetched content
 *   FollowAdapter  — navigate browser to a URL
 *
 * REGISTRY:
 *   setAdapters({ search, fetch, extract, follow }) — inject at runtime
 *   getAdapters() — read current adapters
 *
 * IMPLEMENTATIONS:
 *   FreeSearchAdapter    — free-search MCP (DDG+Mojeek, no API key)
 *   ForgeSearchAdapter   — forge_search (Brave-governed, needs valid key)
 *   ForgeFetchAdapter    — forge_fetch (governed URL intake)
 *   MockSearchAdapter    — fixture data for tests
 *   MockFetchAdapter     — fixture data for tests
 *
 * @author 333-AGI Δ MIND
 * @since  2026-08-10
 * @phase  Phase 1.5 — adapter layer bridging scaffold to real tools
 */

// ===========================================================================
// Result Types
// ===========================================================================

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  /** Priority score from the search engine (or computed post-hoc) */
  priorityScore: number;
  /** Source: which adapter produced this result */
  source: string;
}

export interface FetchedPage {
  url: string;
  title: string;
  /** Cleaned text content (markdown) */
  content: string;
  /** Raw HTML (for link extraction) */
  html?: string;
  /** Extracted outbound links */
  links?: string[];
  /** Fetch metadata */
  metadata: {
    fetchedAt: string;
    contentLength: number;
    statusCode?: number;
    adapter: string;
  };
}

// ===========================================================================
// Adapter Interfaces
// ===========================================================================

export interface SearchAdapter {
  name: string;
  search(query: string, maxResults?: number): Promise<SearchResult[]>;
}

export interface FetchAdapter {
  name: string;
  fetch(url: string, maxChars?: number): Promise<FetchedPage>;
}

export interface ExtractAdapter {
  name: string;
  extractLinks(content: string, baseUrl?: string): string[];
}

// ===========================================================================
// Adapter Registry (DI container)
// ===========================================================================

interface AdapterSet {
  search: SearchAdapter | null;
  fetch: FetchAdapter | null;
  extract: ExtractAdapter | null;
}

const _registry: AdapterSet = {
  search: null,
  fetch: null,
  extract: null,
};

/** Inject adapters at runtime. Call before runGraph(). */
export function setAdapters(adapters: Partial<AdapterSet>): void {
  if (adapters.search !== undefined) _registry.search = adapters.search;
  if (adapters.fetch !== undefined) _registry.fetch = adapters.fetch;
  if (adapters.extract !== undefined) _registry.extract = adapters.extract;
}

/** Read current adapters. Graph nodes import this. */
export function getAdapters(): Readonly<AdapterSet> {
  return _registry;
}

// ===========================================================================
// Built-in: Simple Link Extractor (no network needed)
// ===========================================================================

/**
 * Extracts absolute URLs from HTML href attributes and markdown links.
 * Pure function — no network call. Used as default ExtractAdapter.
 */
function extractLinksFromContent(content: string, baseUrl?: string): string[] {
  const links = new Set<string>();

  // Match HTML href: href="..." or href='...'
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(content)) !== null) {
    let url = match[1];
    if (url.startsWith('#') || url.startsWith('javascript:')) continue;
    if (url.startsWith('//')) url = 'https:' + url;
    if (url.startsWith('/') && baseUrl) {
      try {
        url = new URL(url, baseUrl).href;
      } catch { continue; }
    }
    if (url.startsWith('http')) links.add(url);
  }

  // Match markdown links: [text](url)
  const mdRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  while ((match = mdRegex.exec(content)) !== null) {
    let url = match[2];
    if (url.startsWith('#') || url.startsWith('javascript:')) continue;
    if (url.startsWith('//')) url = 'https:' + url;
    if (url.startsWith('/') && baseUrl) {
      try {
        url = new URL(url, baseUrl).href;
      } catch { continue; }
    }
    if (url.startsWith('http')) links.add(url);
  }

  return Array.from(links);
}

export const SIMPLE_EXTRACT_ADAPTER: ExtractAdapter = {
  name: 'simple-extract',
  extractLinks: extractLinksFromContent,
};

// ===========================================================================
// Built-in: Mock Adapters (for testing)
// ===========================================================================

export const MOCK_SEARCH_ADAPTER: SearchAdapter = {
  name: 'mock-search',
  async search(query: string, maxResults: number = 5): Promise<SearchResult[]> {
    return [
      { url: 'https://example.com/result1', title: `Result for: ${query}`, snippet: 'Mock result 1', priorityScore: 0.9, source: 'mock' },
      { url: 'https://example.com/result2', title: `Result for: ${query}`, snippet: 'Mock result 2', priorityScore: 0.7, source: 'mock' },
      { url: 'https://example.com/result3', title: `Result for: ${query}`, snippet: 'Mock result 3', priorityScore: 0.5, source: 'mock' },
    ].slice(0, maxResults);
  },
};

export const MOCK_FETCH_ADAPTER: FetchAdapter = {
  name: 'mock-fetch',
  async fetch(url: string): Promise<FetchedPage> {
    return {
      url,
      title: `Mock page: ${url}`,
      content: `# Mock Content for ${url}\n\nThis is mock content. [Link to example](https://example.com/linked) and another [Reference](https://ref.com/doc).`,
      html: `<html><body><p>Mock. <a href="https://example.com/linked">Link</a> <a href="https://ref.com/doc">Reference</a></p></body></html>`,
      links: ['https://example.com/linked', 'https://ref.com/doc'],
      metadata: { fetchedAt: new Date().toISOString(), contentLength: 100, adapter: 'mock' },
    };
  },
};

// ===========================================================================
// Auto-register: simple extract adapter is always available as default
// ===========================================================================

_registry.extract = SIMPLE_EXTRACT_ADAPTER;
