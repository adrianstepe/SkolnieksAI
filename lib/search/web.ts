/**
 * lib/search/web.ts
 *
 * Web search fallback for when RAG has low retrieval confidence.
 *
 * Priority:
 *   1. Tavily Search API  — if TAVILY_API_KEY is set (1 000 free/month; hard cap 800)
 *   2. Brave Search API   — if BRAVE_SEARCH_API_KEY is set (2 000 free/month)
 *   3. Wikipedia LV REST API — free, no key, never blocked from cloud hosts,
 *      excellent curriculum coverage (Wikimedia explicitly allows bot access)
 *   4. DuckDuckGo HTML scrape — last resort only (may be blocked from datacenter IPs)
 *
 * Queries are scoped to Latvian educational domains so results stay on-topic.
 * STEM_FACTUAL intent bypasses the domain allowlist so OpenStax-style content
 * from the open web can surface.
 */

/**
 * Caller intent — controls how strictly Tavily filters by domain.
 *   LATVIA_SPECIFIC  → strict allowlist (.gov.lv, skola2030.lv, lv.wikipedia.org, …)
 *   STEM_FACTUAL     → empty include_domains (search all of web; best for physics, maths, etc.)
 */
export type SearchIntent = "LATVIA_SPECIFIC" | "STEM_FACTUAL";

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
  favicon: string; // https://www.google.com/s2/favicons?domain=X&sz=32
}

/** Max results returned by webSearch — hard-capped at 3 until paying users exist. */
const MAX_RESULTS_CAP = 3;

/**
 * Approved Latvian educational sources.
 * Used to rank Brave/DDG results; also the Tavily include_domains for LATVIA_SPECIFIC.
 * NOTE: lv.wikipedia.org is intentionally more specific than "wikipedia.org" so that
 * Tavily's domain filter targets the Latvian article corpus.
 */
const ALLOW_DOMAINS = [
  "izm.gov.lv",
  "skola2030.lv",
  "visc.gov.lv",
  "viaa.gov.lv",
  "maciunmaci.lv",
  "likumi.lv",
  "lv.wikipedia.org",
];

/**
 * Homework-answer / cheating sites — never surface these to students.
 */
const BLOCK_DOMAINS = ["uzdevumi.lv", "brainly.com"];

/**
 * Latvian educational domains to prioritise in Brave/DDG query strings.
 * Appended as a site-scoped hint so results are relevant.
 */
const EDU_SCOPE =
  "site:visc.gov.lv OR site:skola2030.lv OR site:izm.gov.lv OR site:viaa.gov.lv OR site:maciunmaci.lv OR site:likumi.lv OR site:wikipedia.org";

const BLOCK_SCOPE = BLOCK_DOMAINS.map((d) => `-site:${d}`).join(" ");

/** Tavily free tier = 1 000 calls/month. Leave 200 buffer. */
const TAVILY_MONTHLY_CAP = 800;

// ---------------------------------------------------------------------------
// Tavily monthly counter (Firestore)
// ---------------------------------------------------------------------------

/**
 * Reads the current month's Tavily call count from Firestore and increments it
 * atomically. Returns true if the call is within budget, false if capped.
 *
 * Doc: usage_counters/tavily_monthly  — fields are YYYY-MM keys.
 * Old-month fields are naturally ignored; no explicit reset needed.
 */
async function checkAndIncrementTavilyCounter(): Promise<boolean> {
  try {
    const { adminDb } = await import("../firebase/admin");
    const { FieldValue } = await import("firebase-admin/firestore");

    const monthKey = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const docRef = adminDb.collection("usage_counters").doc("tavily_monthly");

    const snap = await docRef.get();
    const currentCount = ((snap.data() ?? {})[monthKey] as number | undefined) ?? 0;

    if (currentCount >= TAVILY_MONTHLY_CAP) {
      console.warn(
        `[web-search] Tavily monthly cap reached (${currentCount}/${TAVILY_MONTHLY_CAP} for ${monthKey}) — skipping Tavily, falling through to Wikipedia LV`,
      );
      return false;
    }

    // Atomic increment — fire-and-forget is fine (soft limit, not billing)
    docRef.set({ [monthKey]: FieldValue.increment(1) }, { merge: true }).catch((err) => {
      console.warn("[web-search] Tavily counter increment failed (non-fatal):", err);
    });

    return true;
  } catch (err) {
    // Counter unavailable (e.g. no Firebase in test env) — allow the call
    console.warn("[web-search] Tavily counter check failed (allowing call):", err);
    return true;
  }
}

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------

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
 * Apply domain policy as a *preference*, not a hard filter:
 *   1. Always drop results whose root domain is in BLOCK_DOMAINS (cheating sites).
 *   2. Drop search-engine intermediary URLs (DDG redirect leftovers, empty hosts).
 *   3. Sort allowlisted domains first so trusted edu sources rank highest.
 */
function applyDomainPolicy(results: WebSearchResult[]): WebSearchResult[] {
  const cleaned = results.filter((r) => {
    const domain = rootDomain(r.url);
    if (!domain) return false;
    if (domain === "duckduckgo.com") return false;
    if (BLOCK_DOMAINS.some((b) => domain === b || domain.endsWith(`.${b}`))) return false;
    return true;
  });

  // Stable partition: allowlisted first, others after.
  const isAllowed = (r: WebSearchResult) => {
    const domain = rootDomain(r.url);
    return ALLOW_DOMAINS.some((a) => domain === a || domain.endsWith(`.${a}`));
  };
  const allowed = cleaned.filter(isAllowed);
  const others = cleaned.filter((r) => !isAllowed(r));
  return [...allowed, ...others];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run a web search and return up to 3 snippets (hard cap, free tier).
 *
 * @param query       Natural-language query
 * @param maxResults  Desired result count — clamped to MAX_RESULTS_CAP (3)
 * @param intent      Controls Tavily domain scope.
 *                    LATVIA_SPECIFIC (default) = strict .gov.lv / lv.wikipedia.org allowlist.
 *                    STEM_FACTUAL = unrestricted (OpenStax-style content not on .gov.lv).
 */
export async function webSearch(
  query: string,
  maxResults = 3,
  intent: SearchIntent = "LATVIA_SPECIFIC",
): Promise<WebSearchResult[]> {
  const limit = Math.min(maxResults, MAX_RESULTS_CAP);
  // Ask for extra results before filtering so we still hit `limit` after domain-policy trim
  const fetchCount = Math.min(limit * 3, 30);
  const scopedQuery = `${query} ${EDU_SCOPE} ${BLOCK_SCOPE}`;

  // ── 1. Tavily ────────────────────────────────────────────────────────────
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    const withinBudget = await checkAndIncrementTavilyCounter();
    if (withinBudget) {
      try {
        const results = await searchTavily(query, tavilyKey, limit, intent);
        if (results.length > 0) {
          console.log(`[web-search] Tavily returned ${results.length} result(s) (intent=${intent})`);
          return results;
        }
        console.log("[web-search] Tavily returned 0 results — falling through");
      } catch (err) {
        console.warn("[web-search] Tavily failed:", err);
      }
    }
    // Counter capped or Tavily failed — skip straight to Wikipedia LV
    return searchWikipediaLv(query, limit).then((wiki) => {
      if (wiki.length > 0) {
        console.log(`[web-search] Wikipedia LV (Tavily fallback) returned ${wiki.length} result(s)`);
      }
      return wiki;
    }).catch(() => []);
  }

  // ── 2. Brave Search API ──────────────────────────────────────────────────
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  if (braveKey) {
    try {
      const scoped = applyDomainPolicy(await searchBrave(scopedQuery, braveKey, fetchCount));
      if (scoped.length > 0) return scoped.slice(0, limit);
    } catch (err) {
      console.warn("[web-search] Brave Search (scoped) failed:", err);
    }
    try {
      const broad = applyDomainPolicy(await searchBrave(query, braveKey, fetchCount));
      if (broad.length > 0) return broad.slice(0, limit);
    } catch (err) {
      console.warn("[web-search] Brave Search (broad) failed, falling back to Wikipedia:", err);
    }
  }

  // ── 3. Wikipedia LV REST API ─────────────────────────────────────────────
  try {
    const wiki = await searchWikipediaLv(query, limit);
    if (wiki.length > 0) {
      console.log(`[web-search] Wikipedia LV returned ${wiki.length} result(s)`);
      return wiki;
    }
    console.log("[web-search] Wikipedia LV returned 0 results — trying DuckDuckGo");
  } catch (err) {
    console.warn("[web-search] Wikipedia LV failed:", err);
  }

  // ── 4. DuckDuckGo HTML scrape ─────────────────────────────────────────────
  try {
    const scoped = applyDomainPolicy(await searchDuckDuckGo(scopedQuery, fetchCount));
    if (scoped.length > 0) return scoped.slice(0, limit);
    console.log("[web-search] Scoped DDG returned 0 results — retrying broadly");
    const broad = applyDomainPolicy(await searchDuckDuckGo(query, fetchCount));
    return broad.slice(0, limit);
  } catch (err) {
    console.warn("[web-search] DuckDuckGo scrape failed:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Tavily Search API  (https://tavily.com — 1 000 free queries/month)
// ---------------------------------------------------------------------------

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  snippet?: string;
}

interface TavilySearchResponse {
  results?: TavilyResult[];
}

async function searchTavily(
  query: string,
  apiKey: string,
  maxResults: number,
  intent: SearchIntent,
): Promise<WebSearchResult[]> {
  // STEM_FACTUAL: unrestricted search so OpenStax-style content surfaces.
  // LATVIA_SPECIFIC: restrict to trusted Latvian educational domains.
  const includeDomains: string[] = intent === "STEM_FACTUAL" ? [] : ALLOW_DOMAINS;

  const body: Record<string, unknown> = {
    api_key: apiKey,
    query,
    max_results: maxResults,
    search_depth: "basic",
  };
  if (includeDomains.length > 0) {
    body.include_domains = includeDomains;
  }
  // Always exclude cheating sites regardless of intent
  body.exclude_domains = BLOCK_DOMAINS;

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    throw new Error(`Tavily HTTP ${res.status}`);
  }

  const data = (await res.json()) as TavilySearchResponse;
  const results = data.results ?? [];

  return results
    .filter((r): r is Required<Pick<TavilyResult, "title" | "url">> & TavilyResult =>
      Boolean(r.title && r.url && (r.content || r.snippet)),
    )
    .slice(0, maxResults)
    .map((r) => ({
      title: r.title!,
      snippet: (r.snippet ?? r.content ?? "").slice(0, 300),
      url: r.url!,
      favicon: faviconUrl(r.url!),
    }));
}

// ---------------------------------------------------------------------------
// Wikipedia LV REST API  (free, no key, Wikimedia allows bot access)
// https://lv.wikipedia.org/w/rest.php/v1/search/page?q=QUERY&limit=N
// ---------------------------------------------------------------------------

interface WikipediaSearchPage {
  key: string;
  title: string;
  description?: string;
  excerpt?: string;
}

interface WikipediaSearchResponse {
  pages?: WikipediaSearchPage[];
}

async function searchWikipediaLv(
  query: string,
  maxResults: number,
): Promise<WebSearchResult[]> {
  const url = `https://lv.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query)}&limit=${maxResults}`;

  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "SkolnieksAI/1.0 (educational tool; https://skolnieksai.lv) node-fetch",
    },
    signal: AbortSignal.timeout(6_000),
  });

  if (!res.ok) throw new Error(`Wikipedia REST ${res.status}`);

  const data = (await res.json()) as WikipediaSearchResponse;
  const pages = data.pages ?? [];

  return pages
    .filter((p) => p.title && (p.excerpt || p.description))
    .map((p) => {
      const slug = p.key.replace(/ /g, "_");
      const snippet = p.excerpt ? stripHtml(p.excerpt) : (p.description ?? "");
      return {
        title: p.title,
        snippet: snippet.slice(0, 300),
        url: `https://lv.wikipedia.org/wiki/${encodeURIComponent(slug)}`,
        favicon: "https://www.google.com/s2/favicons?domain=wikipedia.org&sz=32",
      };
    });
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

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

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
