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
 * Path A threshold: distance < 1.0 = confidently relevant.
 * all-MiniLM-L6-v2 is English-primary; Latvian cross-lingual distances for
 * genuinely relevant chunks land in the 0.85–0.95 range, so 0.85 was too
 * tight and caused all queries to fall through to web search.
 * Higher distances still trigger web search fallback (Path B) or Path C.
 */
export const RAG_DISTANCE_THRESHOLD = 1.0;

/**
 * Subject values actually stored in ChromaDB (from RAG.py + scripts/ingest.ts).
 * "general" and "unknown" are intentionally excluded — they must NOT trigger a
 * where filter so the query searches across all curriculum chunks.
 */
export const KNOWN_CURRICULUM_SUBJECTS = new Set([
  // RAG.py values
  "latvian_literature", "minority_russian", "history", "social_history",
  "social_sciences", "social_studies", "design_tech", "sports", "arts",
  "culture", "latvian", "russian", "english", "french", "german",
  "literature", "math", "biology", "geography", "science", "physics",
  "chemistry", "programming", "cs", "engineering", "visual_arts", "theater", "music",
  // scripts/ingest.ts additional value
  "informatics",
]);

// Shape returned by the Python /query endpoint
interface ChunkMeta {
  source_pdf: string;
  subject: string;
  grade_min: number;
  grade_max: number;
  page_number: number;
  chunk_index: number;
}

interface RagQueryResponse {
  chunks: string[];
  sources: string[];
  distances?: number[];
  metadatas?: ChunkMeta[];
}

export interface RetrieveResult {
  texts: string[];
  sources: string[];
  /** ChromaDB cosine distances per chunk (0–2). Empty if server didn't return them. */
  distances: number[];
  /** Full metadata per chunk returned by the server. */
  metadatas: ChunkMeta[];
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
export async function retrieveContext(
  question: string,
  topK = 3,
  subject?: string,
): Promise<RetrieveResult> {
  const empty: RetrieveResult = { texts: [], sources: [], distances: [], metadatas: [], hasConfidentMatch: false };
  try {
    // Only pass a subject filter when it's a known curriculum subject.
    // "general" and "unknown" must not filter — they should search all chunks.
    const whereSubject =
      subject !== undefined && KNOWN_CURRICULUM_SUBJECTS.has(subject) ? subject : undefined;

    const res = await fetch(`${RAG_API_URL}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": RAG_API_KEY },
      body: JSON.stringify({
        question,
        top_k: topK,
        ...(whereSubject !== undefined ? { where_subject: whereSubject } : {}),
      }),
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
    const metadatas = data.metadatas ?? [];
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
      metadatas,
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
      (Array.isArray(v.distances) && v.distances.every((d) => typeof d === "number"))) &&
    (v.metadatas === undefined || Array.isArray(v.metadatas))
  );
}
