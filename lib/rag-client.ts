/**
 * HTTP client for the local Python RAG API (localhost:8001).
 * Keeps TypeScript/Next.js code decoupled from the Python process.
 */

const RAG_API_URL = process.env.RAG_API_URL ?? "http://localhost:8001";

// Shape returned by the Python /query endpoint
interface RagQueryResponse {
  chunks: string[];
  sources: string[];
}

export interface RetrieveResult {
  texts: string[];
  sources: string[];
}

/**
 * Query the local Python RAG API and return chunk texts + labelled sources.
 * Returns empty arrays if the RAG service is unavailable or returns an error.
 */
export async function retrieveContext(question: string): Promise<RetrieveResult> {
  const empty: RetrieveResult = { texts: [], sources: [] };
  try {
    const res = await fetch(`${RAG_API_URL}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
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

    return {
      texts: data.chunks,
      sources: data.sources,
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
// Type guard
// ---------------------------------------------------------------------------

function isRagQueryResponse(value: unknown): value is RagQueryResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.chunks) &&
    Array.isArray(v.sources) &&
    v.chunks.every((c) => typeof c === "string") &&
    v.sources.every((s) => typeof s === "string")
  );
}
