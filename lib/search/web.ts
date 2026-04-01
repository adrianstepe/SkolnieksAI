/**
 * lib/search/web.ts
 *
 * Web search fallback for when RAG has low retrieval confidence.
 *
 * Priority:
 *   1. Brave Search API  — if BRAVE_SEARCH_API_KEY is set (2 000 free/month)
 *   2. DuckDuckGo HTML  — zero-cost scrape, no API key required
 *
 * Queries are scoped to Latvian educational domains so results stay on-topic.
 * Results are post-filtered: blocklist domains are always removed; only
 * allowlist domains are kept (applied after fetch so we don't lose coverage
 * when the scoped query returns nothing).
 */

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
  favicon: string; // https://www.google.com/s2/favicons?domain=X&sz=32
}

/**
 * Approved Latvian educational sources.
 * Results from any other domain are discarded.
 */
const ALLOW_DOMAINS = [
  "izm.gov.lv",
  "skola2030.lv",
  "visc.gov.lv",
  "viaa.gov.lv",
  "maciunmaci.lv",
  "likumi.lv",
  "wikipedia.org", // covers lv.wikipedia.org, en.wikipedia.org, etc.
];

/**
 * Homework-answer / cheating sites — never surface these to students.
 */
const BLOCK_DOMAINS = ["uzdevumi.lv", "brainly.com"];

/**
 * Latvian educational domains to prioritise in search queries.
 * Appended as a site-scoped hint so results are relevant.
 * Blocklist domains are also negated in the query string.
 */
const EDU_SCOPE =
  "site:visc.gov.lv OR site:skola2030.lv OR site:izm.gov.lv OR site:viaa.gov.lv OR site:maciunmaci.lv OR site:likumi.lv OR site:wikipedia.org";

const BLOCK_SCOPE = BLOCK_DOMAINS.map((d) => `-site:${d}`).join(" ");

/** Returns the eTLD+1-style hostname (e.g. "lv.wikipedia.org" → "wikipedia.org"). */
function rootDomain(url: string): string {
  try {
    const parts = new URL(url).hostname.split(".");
    return parts.length >= 2 ? parts.slice(-2).join(".") : parts.join(".");
  } catch {
    return "";
  }
}

/**
 * Keep only results from ALLOW_DOMAINS; drop any from BLOCK_DOMAINS.
 * If the allowlist produces 0 results (e.g. scoped query returned unfiltered
 * results on a broad retry) we return an empty array so the chain falls to
 * Path C rather than surfacing off-topic content.
 */
function filterByDomainPolicy(results: WebSearchResult[]): WebSearchResult[] {
  return results.filter((r) => {
    const domain = rootDomain(r.url);
    if (BLOCK_DOMAINS.some((b) => domain === b || domain.endsWith(`.${b}`))) return false;
    return ALLOW_DOMAINS.some((a) => domain === a || domain.endsWith(`.${a}`));
  });
}

/**
 * Run a web search and return up to `maxResults` snippets.
 * Tries Brave Search first (if key configured), falls back to DuckDuckGo.
 * First attempts a scoped query (Latvian edu sites); if that returns nothing,
 * retries with a broader query so Path C is only hit when truly no info exists.
 * All results are filtered through the domain allowlist/blocklist before return.
 * Returns an empty array on any failure — web search is best-effort.
 */
export async function webSearch(
  query: string,
  maxResults = 3,
): Promise<WebSearchResult[]> {
  // Ask for extra results before filtering so we hit maxResults after the domain policy trim
  const fetchCount = Math.min(maxResults * 3, 30);
  const scopedQuery = `${query} ${EDU_SCOPE} ${BLOCK_SCOPE}`;

  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  if (braveKey) {
    try {
      const scoped = filterByDomainPolicy(await searchBrave(scopedQuery, braveKey, fetchCount));
      if (scoped.length > 0) return scoped.slice(0, maxResults);
    } catch (err) {
      console.warn("[web-search] Brave Search (scoped) failed:", err);
    }
    // Scoped returned nothing — retry broadly (domain filter still applied)
    try {
      const broad = filterByDomainPolicy(await searchBrave(query, braveKey, fetchCount));
      if (broad.length > 0) return broad.slice(0, maxResults);
    } catch (err) {
      console.warn("[web-search] Brave Search (broad) failed, falling back to DuckDuckGo:", err);
    }
  }

  // DuckDuckGo: try scoped first, then broad
  try {
    const scoped = filterByDomainPolicy(await searchDuckDuckGo(scopedQuery, fetchCount));
    if (scoped.length > 0) return scoped.slice(0, maxResults);
    console.log("[web-search] Scoped DDG returned 0 results after domain filter — retrying broadly");
    const broad = filterByDomainPolicy(await searchDuckDuckGo(query, fetchCount));
    return broad.slice(0, maxResults);
  } catch (err) {
    console.warn("[web-search] DuckDuckGo scrape failed:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Brave Search API  (https://brave.com/search/api/ — 2 000 free queries/month)
// ---------------------------------------------------------------------------

interface BraveWebResult {
  title?: string;
  description?: string;
  url?: string;
}

interface BraveSearchResponse {
  web?: { results?: BraveWebResult[] };
}

async function searchBrave(
  query: string,
  apiKey: string,
  maxResults: number,
): Promise<WebSearchResult[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}&search_lang=lv&ui_lang=lv`;

  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    throw new Error(`Brave Search HTTP ${res.status}`);
  }

  const data = (await res.json()) as BraveSearchResponse;
  const results = data.web?.results ?? [];

  return results
    .filter((r): r is Required<BraveWebResult> => Boolean(r.title && r.description && r.url))
    .slice(0, maxResults)
    .map((r) => ({ title: r.title, snippet: r.description, url: r.url, favicon: faviconUrl(r.url) }));
}

// ---------------------------------------------------------------------------
// DuckDuckGo HTML scrape  (zero-cost, no API key)
// ---------------------------------------------------------------------------

async function searchDuckDuckGo(
  query: string,
  maxResults: number,
): Promise<WebSearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=lv-lv`;

  // Hard 5s ceiling — if DDG is slow/blocked, we fall through to Path C
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; SkolnieksAI/1.0; +https://skolnieksai.lv) educational-search",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "lv,en;q=0.5",
    },
    signal: AbortSignal.timeout(5_000),
  });

  if (!res.ok) {
    throw new Error(`DuckDuckGo HTTP ${res.status}`);
  }

  const html = await res.text();
  return parseDdgHtml(html, maxResults);
}

/**
 * Extract search results from DuckDuckGo HTML response using regex.
 * DDG HTML format is stable enough for this lightweight parse.
 */
function parseDdgHtml(html: string, maxResults: number): WebSearchResult[] {
  const results: WebSearchResult[] = [];

  // Each result block: <div class="result results_links ..."> ... </div>
  // Title link:   <a class="result__a" href="REDIRECT_URL">TITLE</a>
  // Snippet:      <a class="result__snippet" ...>SNIPPET</a>
  const blockRegex = /<div[^>]+class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;

  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(html)) !== null && results.length < maxResults) {
    const block = match[1];

    const titleMatch = /<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    const snippetMatch = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    const urlMatch = /uddg=([^&"]+)/i.exec(block);

    if (!titleMatch || !snippetMatch) continue;

    const title = stripHtml(titleMatch[1]).trim();
    const snippet = stripHtml(snippetMatch[1]).trim();
    const url = urlMatch ? decodeURIComponent(urlMatch[1]) : "";

    if (!title || !snippet) continue;
    results.push({ title, snippet, url, favicon: faviconUrl(url) });
  }

  // Fallback: simpler regex if block regex matched nothing (DDG layout change)
  if (results.length === 0) {
    const snippets = [...html.matchAll(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi)];
    const titles = [...html.matchAll(/<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)];

    for (let i = 0; i < Math.min(maxResults, snippets.length); i++) {
      const snippet = stripHtml(snippets[i][1]).trim();
      const title = titles[i] ? stripHtml(titles[i][2]).trim() : "";
      const urlRaw = titles[i]?.[1] ?? "";
      const urlMatch = /uddg=([^&"]+)/i.exec(urlRaw);
      const url = urlMatch ? decodeURIComponent(urlMatch[1]) : urlRaw;
      if (snippet) results.push({ title, snippet, url, favicon: faviconUrl(url) });
    }
  }

  console.log(`[web-search] DuckDuckGo returned ${results.length} result(s)`);
  return results;
}

function faviconUrl(url: string): string {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return `https://www.google.com/s2/favicons?domain=lv&sz=32`;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
