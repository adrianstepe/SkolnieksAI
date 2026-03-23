/**
 * HTTP client for the local Python RAG API (localhost:8001).
 * Keeps TypeScript/Next.js code decoupled from the Python process.
 */

const RAG_API_URL = process.env.RAG_API_URL ?? "http://localhost:8001";
const RAG_API_KEY = process.env.RAG_API_KEY ?? "";

/**
 * ChromaDB cosine distance: 0 = identical, 2 = opposite.
 * A distance above this threshold means the retrieved chunk is unlikely to
 * contain a confident answer to the question — triggers web search fallback.
 */
/**
 * Path A threshold: distance < 0.35 = confidently relevant (≥82.5% cosine similarity).
 * Higher distances trigger web search fallback (Path B) or Path C.
 */
export const RAG_DISTANCE_THRESHOLD = 0.35;

// Shape returned by the Python /query endpoint
// `distances` is optional — only present if the Python server returns them
interface RagQueryResponse {
  chunks: string[];
  sources: string[];
  distances?: number[];
}

export interface RetrieveResult {
  texts: string[];
  sources: string[];
  /** ChromaDB cosine distances per chunk (0–2). Empty if server didn't return them. */
  distances: number[];
  /**
   * True when at least one retrieved chunk is confidently relevant.
   * False when: no chunks returned, OR all distances exceed RAG_DISTANCE_THRESHOLD.
   * When distances are absent we treat non-empty chunks as confident (safe default).
   */
  hasConfidentMatch: boolean;
}

/**
 * Query the local Python RAG API and return chunk texts + labelled sources.
 * Returns empty arrays if the RAG service is unavailable or returns an error.
 */
export async function retrieveContext(question: string, topK = 3): Promise<RetrieveResult> {
  const empty: RetrieveResult = { texts: [], sources: [], distances: [], hasConfidentMatch: false };
  try {
    const res = await fetch(`${RAG_API_URL}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": RAG_API_KEY },
      body: JSON.stringify({ question, top_k: topK }),
      // Abort quickly so a dead RAG service doesn't block the chat response
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      console.error(`[rag-client] HTTP ${res.status} from RAG API`);
      return empty;
    }

    const data: unknown = await res.json();

    if (!isRagQueryResponse(data)) {
      console.error("[rag-client] Unexpected response shape from RAG API", data);
      return empty;
    }

    const distances = data.distances ?? [];
    const hasConfidentMatch = computeConfidence(data.chunks, distances);

    // Debug: log what was retrieved so we can audit ChromaDB contents
    if (data.chunks.length === 0) {
      console.warn("[rag-client] RAG returned 0 chunks — ChromaDB may be empty or query had no matches");
    } else {
      const scoreInfo = distances.length > 0
        ? distances.map((d, i) => `chunk[${i}] dist=${d.toFixed(3)}`).join(", ")
        : `${data.chunks.length} chunk(s) (no distances returned)`;
      console.log(`[rag-client] Retrieved: ${scoreInfo} | confident=${hasConfidentMatch}`);
      console.log(`[rag-client] Sources: ${data.sources.join(", ")}`);
    }

    return {
      texts: data.chunks,
      sources: data.sources,
      distances,
      hasConfidentMatch,
    };
  } catch (err) {
    // Network error, timeout, or JSON parse failure — RAG is optional
    if (err instanceof Error) {
      console.error(`[rag-client] RAG unavailable: ${err.message}`);
    }
    return empty;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeConfidence(chunks: string[], distances: number[]): boolean {
  if (chunks.length === 0) return false;
  // If the server didn't return distances, assume confident (avoids false web-search triggers)
  if (distances.length === 0) return true;
  // Confident if at least one chunk is within the distance threshold
  return distances.some((d) => d < RAG_DISTANCE_THRESHOLD);
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

function isRagQueryResponse(value: unknown): value is RagQueryResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.chunks) &&
    Array.isArray(v.sources) &&
    v.chunks.every((c) => typeof c === "string") &&
    v.sources.every((s) => typeof s === "string") &&
    (v.distances === undefined ||
      (Array.isArray(v.distances) && v.distances.every((d) => typeof d === "number")))
  );
}
